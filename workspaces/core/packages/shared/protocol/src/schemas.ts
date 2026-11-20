import { Schema } from 'effect';

/** A time on the wire, an RFC 3339 string. */
export const WireTime = Schema.DateTimeUtcFromString;

export type WireTime = typeof WireTime.Type;

/**
 * The fields of a record of a kind a newer deployment added, which this release does not know, as the wire wrote them.
 * A reader keeps them whole, so the record encodes again as it came.
 */
export const UnknownFields = Schema.Record(Schema.String, Schema.Unknown);

export type UnknownFields = typeof UnknownFields.Type;
