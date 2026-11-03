import { Schema } from 'effect';
import { RANDOM_UUID_VERSION } from './constants.ts';
import { RecordId } from './schemas.ts';

/** A retained request identity remains readable independently of current admission rules. */
export const BoundedRequestRecordId = RecordId.pipe(Schema.brand('BoundedRequestId'));

export type BoundedRequestRecordId = typeof BoundedRequestRecordId.Type;

/** The caller retains this ID when retrying a bounded submission. */
export const BoundedRequestId = BoundedRequestRecordId.check(Schema.isUUID(RANDOM_UUID_VERSION));

export type BoundedRequestId = typeof BoundedRequestId.Type;

/** Pi retains the provider's tool-call identity, which need not be a UUID. */
export const ModelToolCallId = Schema.NonEmptyString.pipe(Schema.brand('ModelToolCallId'));

export type ModelToolCallId = typeof ModelToolCallId.Type;
