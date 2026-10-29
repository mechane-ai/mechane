import { ForkPoint } from '@mechane/protocol';
import { RecordId, wireStruct } from '@mechane/records';

/** The new mech as `mechane mech fork` prints it: its id, and the parent and sequence it was forked at. */
export const ForkRecord = wireStruct({ fields: { id: RecordId, forkedFrom: ForkPoint } });

export type ForkRecord = typeof ForkRecord.Type;
