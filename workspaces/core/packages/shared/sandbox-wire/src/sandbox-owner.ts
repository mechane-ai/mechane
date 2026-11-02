import { DroneId, MechId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** The trusted mech identity that determines a sandbox's object name and workspace capacity owner. */
export const SandboxOwner = Schema.Struct({
  workspaceId: WorkspaceId,
  mechId: MechId,
  /** Absent for the mech's own sandbox. */
  droneId: Schema.OptionFromNullOr(DroneId),
});

export type SandboxOwner = typeof SandboxOwner.Type;
