import type { CredentialMetadata } from '@mechane/protocol';
import { decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { CredentialMetadataRow } from './schemas.ts';

/** Listing credentials never reads their encrypted values into the response path. */
export function listCredentials({ sql }: RecordsInput): ReadonlyArray<CredentialMetadata> {
  const cursor = sql.exec(
    'SELECT secret_reference, key_version, created_at_ms, updated_at_ms FROM integration_credentials ORDER BY secret_reference',
  );

  return decodeRows({ cursor, schema: CredentialMetadataRow });
}
