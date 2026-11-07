import { RecordId, wireStruct } from '@mechane/records';

/** The path of an operation on one mech of a workspace. */
export const MechPath = wireStruct({ fields: { workspaceId: RecordId, mechId: RecordId } });

export type MechPath = typeof MechPath.Type;
