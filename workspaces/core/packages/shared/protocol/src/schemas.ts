import { Schema } from 'effect';
import { REVISION_PATTERN } from './releases/constants.ts';

/** The revision of the source a release or a Worker was built from, as `git describe` names it. */
export const Revision = Schema.String.check(Schema.isPattern(REVISION_PATTERN));

export type Revision = typeof Revision.Type;

/** A time on the wire, an RFC 3339 string. */
export const WireTime = Schema.DateTimeUtcFromString;

export type WireTime = typeof WireTime.Type;

/**
 * The fields of a record of a kind a newer deployment added, which this release does not know, as the wire wrote them.
 * A reader keeps them whole, so the record encodes again as it came.
 */
export const UnknownFields = Schema.Record(Schema.String, Schema.Unknown);

export type UnknownFields = typeof UnknownFields.Type;
