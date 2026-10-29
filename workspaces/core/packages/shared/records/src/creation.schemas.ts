import { Schema } from 'effect';
import { RANDOM_UUID_VERSION } from './constants.ts';
import { RecordId } from './schemas.ts';

/** A creation request ID already retained by the service, independent of current admission rules. */
export const CreationRequestRecordId = RecordId.pipe(Schema.brand('CreationRequestId'));

export type CreationRequestRecordId = typeof CreationRequestRecordId.Type;

/** A caller-generated UUIDv4 that makes a creation or clone request safe to retry. */
export const CreationRequestId = CreationRequestRecordId.check(Schema.isUUID(RANDOM_UUID_VERSION));

export type CreationRequestId = typeof CreationRequestId.Type;
