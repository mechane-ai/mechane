import { MechId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** The trusted mech identity that determines a sandbox's object name. */
export const SandboxOwner = Schema.Struct({ workspaceId: WorkspaceId, mechId: MechId });

export type SandboxOwner = typeof SandboxOwner.Type;
