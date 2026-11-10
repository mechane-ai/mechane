import { CredentialAlreadyExists } from '@mechane/protocol';
import { RecordText, SHA256_PATTERN } from '@mechane/records';
import { Redacted, Result, Schema } from 'effect';
import { Base64, Hex } from 'effect/encoding';
import { webcrypto } from 'node:crypto';
import type { CredentialEnvelope, CredentialKeyring, CredentialMetadata, ExecutionAccess } from '../domain.ts';
import { recordConfigurationChange } from './api/configuration/audit.ts';
import { lockWorkspaceAuthority } from './api/configuration/authority.ts';
import type { WorkspaceActor } from './api/configuration/types.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { StoredText } from './row-values.ts';

const ALGORITHM = 'AES-GCM';
const NONCE_BYTES = 12;
const PURPOSE = 'mechane.workspace-credential.v1';

const MetadataSchema = Schema.Struct({
  workspace_id: StoredText,
  reference: StoredText,
  key_version: StoredText,
  created_at: StoredText,
  updated_at: StoredText,
});

const EnvelopeSchema = Schema.Struct({ key_version: StoredText, nonce: StoredText, ciphertext: StoredText });

const AccessSchema = Schema.Struct({
  variables: Schema.Record(StoredText, StoredText),
  secrets: Schema.Record(StoredText, StoredText),
});

type CredentialIdentity = { readonly workspaceId: string; readonly reference: string };

export type ConfigureCredential = CredentialIdentity &
  WorkspaceActor & { readonly value: Redacted.Redacted; readonly isCreateOnly?: boolean };

export type RemoveCredential = CredentialIdentity & WorkspaceActor;
type MechIdentity = { readonly workspaceId: string; readonly mechId: string };

function associatedData({ workspaceId, reference }: CredentialIdentity): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(JSON.stringify([PURPOSE, workspaceId, reference]));

  return new Uint8Array(encoded);
}

async function importKey(keyring: CredentialKeyring, version: string): Promise<webcrypto.CryptoKey> {
  const key = keyring.keys[version];

  if (key === undefined || !SHA256_PATTERN.test(key.toLowerCase())) {
    throw new StoreConflict('Credential key is unavailable');
  }

  const decodedKey = Hex.decode(key);
  const bytes = new Uint8Array(Result.getOrThrow(decodedKey));

  return await webcrypto.subtle.importKey('raw', bytes, ALGORITHM, false, ['encrypt', 'decrypt']);
}

async function encrypt(
  identity: CredentialIdentity,
  keyring: CredentialKeyring,
  value: Redacted.Redacted,
): Promise<CredentialEnvelope> {
  const key = await importKey(keyring, keyring.current);
  const nonce = webcrypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const plaintext = new TextEncoder().encode(Redacted.value(value));

  const ciphertext = await webcrypto.subtle.encrypt(
    { name: ALGORITHM, iv: nonce, additionalData: associatedData(identity) },
    key,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(ciphertext);

  return { keyVersion: keyring.current, nonce: Base64.encode(nonce), ciphertext: Base64.encode(encryptedBytes) };
}

async function decrypt(
  identity: CredentialIdentity,
  keyring: CredentialKeyring,
  envelope: CredentialEnvelope,
): Promise<Redacted.Redacted> {
  try {
    const key = await importKey(keyring, envelope.keyVersion);
    const decodedNonce = Base64.decode(envelope.nonce);
    const decodedCiphertext = Base64.decode(envelope.ciphertext);
    const nonce = new Uint8Array(Result.getOrThrow(decodedNonce));
    const ciphertext = new Uint8Array(Result.getOrThrow(decodedCiphertext));

    if (nonce.byteLength !== NONCE_BYTES) {
      throw new StoreConflict('Credential envelope is invalid');
    }

    const plaintext = await webcrypto.subtle.decrypt(
      { name: ALGORITHM, iv: nonce, additionalData: associatedData(identity) },
      key,
      ciphertext,
    );

    return Redacted.make(new TextDecoder().decode(plaintext));
  } catch {
    throw new StoreConflict('Credential could not be decrypted');
  }
}

function metadata(value: unknown): CredentialMetadata {
  const row = Schema.decodeUnknownSync(MetadataSchema)(value);

  return {
    workspaceId: row.workspace_id,
    reference: row.reference,
    keyVersion: row.key_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCredentialStore(context: StoreContext, keyring: CredentialKeyring) {
  return {
    getCredential: async (identity: CredentialIdentity): Promise<Redacted.Redacted | null> => {
      const found = await context.client.query(
        'SELECT key_version,nonce,ciphertext FROM mechane.credentials WHERE workspace_id=$1 AND reference=$2',
        [identity.workspaceId, identity.reference],
      );

      if (found.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(EnvelopeSchema)(found.rows[0]);

      return await decrypt(identity, keyring, {
        keyVersion: row.key_version,
        nonce: row.nonce,
        ciphertext: row.ciphertext,
      });
    },
    configureCredential: async (input: ConfigureCredential): Promise<CredentialMetadata> =>
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        const encrypted = await encrypt(input, keyring, input.value);

        const saved = await transaction.client.query(
          `INSERT INTO mechane.credentials(workspace_id,reference,key_version,nonce,ciphertext)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,reference) DO UPDATE
           SET key_version=excluded.key_version,nonce=excluded.nonce,ciphertext=excluded.ciphertext,updated_at=now()
           WHERE NOT $6 RETURNING workspace_id,reference,key_version,created_at,updated_at`,
          [
            input.workspaceId,
            input.reference,
            encrypted.keyVersion,
            encrypted.nonce,
            encrypted.ciphertext,
            input.isCreateOnly ?? false,
          ],
        );

        if (saved.rows.length === 0) {
          throw new CredentialAlreadyExists({ secretReference: RecordText.make(input.reference) });
        }

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'credential.saved',
          targetId: input.reference,
          recipients: { credentialReference: input.reference },
        });

        return metadata(saved.rows[0]);
      }),
    getCredentialMetadata: async ({
      workspaceId,
      reference,
    }: CredentialIdentity): Promise<CredentialMetadata | null> => {
      const found = await context.client.query(
        'SELECT workspace_id,reference,key_version,created_at,updated_at FROM mechane.credentials WHERE workspace_id=$1 AND reference=$2',
        [workspaceId, reference],
      );

      if (found.rows.length === 0) {
        return null;
      }

      return metadata(found.rows[0]);
    },
    listCredentials: async ({
      workspaceId,
    }: {
      readonly workspaceId: string;
    }): Promise<ReadonlyArray<CredentialMetadata>> => {
      const found = await context.client.query(
        'SELECT workspace_id,reference,key_version,created_at,updated_at FROM mechane.credentials WHERE workspace_id=$1 ORDER BY reference',
        [workspaceId],
      );

      return found.rows.map(metadata);
    },
    removeCredential: async (input: RemoveCredential): Promise<'deleted' | 'missing' | 'in-use'> =>
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        const { client } = transaction;
        const { workspaceId, reference } = input;

        const used = await client.query(
          `
          SELECT EXISTS(
            SELECT 1 FROM mechane.execution_access WHERE workspace_id=$1 AND (
              access->'github'->>'secretReference'=$2 OR access->'requestService'->>'secretReference'=$2 OR
              $2 IN (SELECT jsonb_each_text.value FROM jsonb_each_text(access->'secrets')))
            UNION ALL SELECT 1 FROM mechane.mcp_connections WHERE workspace_id=$1 AND secret_reference=$2
            UNION ALL SELECT 1 FROM mechane.slack_installations WHERE workspace_id=$1 AND deleted_at IS NULL AND
              (bot_token_reference=$2 OR signing_secret_reference=$2 OR history_token_reference=$2)
          ) AS is_used`,
          [workspaceId, reference],
        );

        const usage = Schema.decodeUnknownSync(Schema.Struct({ is_used: Schema.Boolean }))(used.rows[0]);

        if (usage.is_used) {
          return 'in-use';
        }

        const deleted = await client.query(
          'DELETE FROM mechane.credentials WHERE workspace_id=$1 AND reference=$2 RETURNING reference',
          [workspaceId, reference],
        );

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'credential.deleted',
          targetId: reference,
          recipients: { credentialReference: reference },
        });

        if (deleted.rows.length === 0) {
          return 'missing';
        }

        return 'deleted';
      }),
    getExecutionAccess: async ({ workspaceId, mechId }: MechIdentity): Promise<ExecutionAccess | null> => {
      const found = await context.client.query(
        'SELECT access FROM mechane.execution_access WHERE workspace_id=$1 AND mech_id=$2',
        [workspaceId, mechId],
      );

      if (found.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(Schema.Struct({ access: AccessSchema }))(found.rows[0]);

      return row.access;
    },
  };
}
