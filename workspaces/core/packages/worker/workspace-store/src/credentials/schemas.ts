import { CREDENTIAL_METADATA_FIELDS } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** SQLite timestamps use milliseconds in both metadata reads and encrypted credential writes. */
export const METADATA_ROW_FIELDS = {
  ...CREDENTIAL_METADATA_FIELDS,
  createdAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
} as const;

/** Public credential metadata excludes the encrypted envelope stored alongside it. */
export const CredentialMetadataRow = renamedWireStruct({
  fields: METADATA_ROW_FIELDS,
  renames: { createdAt: 'created_at_ms', updatedAt: 'updated_at_ms' },
});

export type CredentialMetadataRow = typeof CredentialMetadataRow.Type;
