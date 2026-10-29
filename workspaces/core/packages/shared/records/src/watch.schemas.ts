import { Schema } from 'effect';
import { RecordId } from './schemas.ts';

/** The stable ID of a schedule owned by one mech. */
export const WatchId = RecordId.pipe(Schema.brand('WatchId'));
export type WatchId = typeof WatchId.Type;

/** The stable ID of a finding retained across observations. */
export const FindingId = RecordId.pipe(Schema.brand('FindingId'));
export type FindingId = typeof FindingId.Type;
