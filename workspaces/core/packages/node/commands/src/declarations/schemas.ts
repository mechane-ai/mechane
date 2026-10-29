import { RecordId, renamedWireStruct } from '@mechane/records';

/** The input of a command on one mech, which names it alone. */
export const MechCommandInput = renamedWireStruct({ fields: { mechId: RecordId }, renames: { mechId: 'mech-id' } });

export type MechCommandInput = typeof MechCommandInput.Type;
