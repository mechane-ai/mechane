import { MechId, RecordId, WatchId, wireStruct, WorkspaceId } from '@mechane/records';

/** The workspace, mech, and watch identified by a watch operation. */
export const WatchPath = wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId, watchId: WatchId } });

export type WatchPath = typeof WatchPath.Type;

/** The path of an operation on one mech of a workspace. */
export const MechPath = wireStruct({ fields: { workspaceId: RecordId, mechId: RecordId } });

export type MechPath = typeof MechPath.Type;
