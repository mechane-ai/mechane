import { CredentialAlreadyExists } from '@mechane/protocol';
import { RecordText } from '@mechane/records';
import type { Redacted } from 'effect';
import { Schema } from 'effect';
import type { CredentialKeyring, CredentialMetadata } from '../domain.ts';
import { recordConfigurationAudit } from './api/configuration/audit.ts';
import { lockWorkspaceAuthority } from './api/configuration/authority.ts';
import type { WorkspaceActor } from './api/configuration/types.ts';
import type { StoreContext } from './context.ts';
import { StoredText } from './row-values.ts';
import { decryptCredential, encryptCredential } from './vault-envelope.ts';

const PURPOSE = 'mechane.workspace-credential.v1';

const MetadataSchema = Schema.Struct({
  workspace_id: StoredText,
  reference: StoredText,
  key_version: StoredText,
  created_at: StoredText,
  updated_at: StoredText,
});

const EnvelopeSchema = Schema.Struct({
  reference: StoredText,
  key_version: StoredText,
  nonce: StoredText,
  ciphertext: StoredText,
});

type CredentialIdentity = { readonly workspaceId: string; readonly reference: string };

export type ConfigureCredential = CredentialIdentity &
  WorkspaceActor & { readonly value: Redacted.Redacted; readonly isCreateOnly?: boolean };

export type RemoveCredential = CredentialIdentity & WorkspaceActor;

export async function readWorkspaceCredentialValues(
  context: StoreContext,
  keyring: CredentialKeyring,
  { workspaceId, references }: { readonly workspaceId: string; readonly references: ReadonlyArray<string> },
): Promise<ReadonlyMap<string, Redacted.Redacted>> {
  const values = new Map<string, Redacted.Redacted>();

  if (references.length === 0) {
    return values;
  }

  const found = await context.client.query(
    'SELECT reference,key_version,nonce,ciphertext FROM mechane.credentials WHERE workspace_id=$1 AND reference=ANY($2::text[])',
    [workspaceId, references],
  );

  for (const row of Schema.decodeUnknownSync(Schema.Array(EnvelopeSchema))(found.rows)) {
    const value = await decryptCredential({ workspaceId, reference: row.reference, purpose: PURPOSE }, keyring, {
      keyVersion: row.key_version,
      nonce: row.nonce,
      ciphertext: row.ciphertext,
    });

    values.set(row.reference, value);
  }

  return values;
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
    configureCredential: async (input: ConfigureCredential): Promise<CredentialMetadata> =>
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        const encrypted = await encryptCredential({ ...input, purpose: PURPOSE }, keyring, input.value);

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

        await recordConfigurationAudit({
          context: transaction,
          ...input,
          action: 'credential.saved',
          targetId: input.reference,
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
            UNION ALL SELECT 1 FROM mechane.managed_command_grants WHERE workspace_id=$1
              AND $2 IN (SELECT jsonb_each_text.value FROM jsonb_each_text(access->'secrets'))
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

        await recordConfigurationAudit({
          context: transaction,
          ...input,
          action: 'credential.deleted',
          targetId: reference,
        });

        if (deleted.rows.length === 0) {
          return 'missing';
        }

        return 'deleted';
      }),
  };
}
