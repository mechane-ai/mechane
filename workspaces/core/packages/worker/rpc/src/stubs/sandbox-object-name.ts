import { Option } from 'effect';
import { mechObjectName } from './mech-object-name.ts';
import type { SandboxOwner } from './types.ts';

/**
 * The name of a sandbox's object: its mech's object's name for the mech's own, and that name with the drone's id below
 * it for each drone's. A mech of another workspace, another mech of the same one, and each drone has another.
 */
export function sandboxObjectName({ workspaceId, mechId, droneId }: SandboxOwner): string {
  const mechName = mechObjectName({ workspaceId, mechId });

  if (Option.isNone(droneId)) {
    return mechName;
  }

  return `${mechName}/drones/${droneId.value}`;
}
