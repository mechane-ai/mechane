import { EncryptedCredential } from '@mechane/deployment';
import type { CredentialMetadata } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { decodeOne } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import { CredentialMetadataRow, METADATA_ROW_FIELDS } from './schemas.ts';
import type { SaveCredentialInput } from './types.ts';

const CredentialRow = renamedWireStruct({
  fields: { ...METADATA_ROW_FIELDS, ...EncryptedCredential.fields },
  renames: { createdAt: 'created_at_ms', updatedAt: 'updated_at_ms' },
});

type CredentialRow = typeof CredentialRow.Type;

/** Credential rotation preserves the original creation time and returns no encrypted value. */
export function saveCredential({
  sql,
  secretReference,
  credential,
  now,
}: SqlCall<SaveCredentialInput>): CredentialMetadata {
  const row = Schema.encodeSync(CredentialRow)({ secretReference, ...credential, createdAt: now, updatedAt: now });

  const cursor = sql.exec(
    'INSERT INTO integration_credentials (secret_reference, key_version, nonce, ciphertext, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (secret_reference) DO UPDATE SET key_version = excluded.key_version, nonce = excluded.nonce, ciphertext = excluded.ciphertext, updated_at_ms = excluded.updated_at_ms RETURNING secret_reference, key_version, created_at_ms, updated_at_ms',
    row.secret_reference,
    row.key_version,
    row.nonce,
    row.ciphertext,
    row.created_at_ms,
    row.updated_at_ms,
  );

  return decodeOne({ cursor, schema: CredentialMetadataRow });
}
