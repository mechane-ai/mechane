import { SHA256_PATTERN } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { webcrypto } from 'node:crypto';
import type { CredentialEnvelope, CredentialKeyring, CredentialMetadata, ExecutionAccess } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { lockWorkspace } from './scope-locks.ts';

const ALGORITHM = 'AES-GCM';
const NONCE_BYTES = 12;
const PURPOSE = 'mechane.workspace-credential.v1';

const MetadataSchema = Schema.Struct({
  workspace_id: Schema.String,
  reference: Schema.String,
  key_version: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
});

const EnvelopeSchema = Schema.Struct({ key_version: Schema.String, nonce: Schema.String, ciphertext: Schema.String });

const AccessSchema = Schema.Struct({
  variables: Schema.Record(Schema.String, Schema.String),
  secrets: Schema.Record(Schema.String, Schema.String),
});

type CredentialIdentity = { readonly workspaceId: string; readonly reference: string };
type PutCredentialInput = CredentialIdentity & { readonly value: Redacted.Redacted; readonly isCreateOnly?: boolean };
type MechIdentity = { readonly workspaceId: string; readonly mechId: string };

function associatedData({ workspaceId, reference }: CredentialIdentity): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify([PURPOSE, workspaceId, reference]));
}

async function importKey(keyring: CredentialKeyring, version: string): Promise<webcrypto.CryptoKey> {
  const key = keyring.keys[version];

  if (key === undefined || !SHA256_PATTERN.test(key.toLowerCase())) {
    throw new StoreConflict('Credential key is unavailable');
  }

  const bytes = new Uint8Array(Buffer.from(key, 'hex'));

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

  return {
    keyVersion: keyring.current,
    nonce: Buffer.from(nonce).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
  };
}

async function decrypt(
  identity: CredentialIdentity,
  keyring: CredentialKeyring,
  envelope: CredentialEnvelope,
): Promise<Redacted.Redacted> {
  try {
    const key = await importKey(keyring, envelope.keyVersion);
    const nonce = new Uint8Array(Buffer.from(envelope.nonce, 'base64'));
    const ciphertext = new Uint8Array(Buffer.from(envelope.ciphertext, 'base64'));

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
    putCredential: async (input: PutCredentialInput): Promise<CredentialMetadata | null> => {
      const encrypted = await encrypt(input, keyring, input.value);

      const saved = await context.client.query(
        `
        INSERT INTO mechane.credentials(workspace_id,reference,key_version,nonce,ciphertext)
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
        return null;
      }

      return metadata(saved.rows[0]);
    },
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
    deleteCredential: async ({
      workspaceId,
      reference,
    }: CredentialIdentity): Promise<'deleted' | 'missing' | 'in-use'> =>
      await context.atomic(async ({ client }) => {
        await lockWorkspace({ client, workspaceId });

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
