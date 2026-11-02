import { KeyPurpose } from '@mechane/protocol';
import { renamedWireStruct, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A cached key no revocation reached, with its principal. */
export const LiveKeyRow = renamedWireStruct({
  fields: Schema.TaggedStruct('Live', {
    keyId: Schema.String,
    keyName: Schema.String,
    purpose: Schema.Enum(KeyPurpose),
    createdAt: Schema.DateTimeUtcFromMillis,
    expiresAt: Schema.DateTimeUtcFromMillis,
    principalId: Schema.String,
    principalName: Schema.String,
  }).fields,
  renames: { createdAt: 'created_at_ms', expiresAt: 'expires_at_ms' },
});

export type LiveKeyRow = typeof LiveKeyRow.Type;

/** A revoked key, whatever else its row holds; a tombstone written before any fill holds nothing else. */
const RevokedKeyRow = wireStruct({ fields: Schema.TaggedStruct('Revoked', {}).fields });

/** A key as its shard holds it, by whether a revocation reached it, which its row's `_tag` column names. */
export const CachedKeyRow = Schema.Union([LiveKeyRow, RevokedKeyRow]);

export type CachedKeyRow = typeof CachedKeyRow.Type;
