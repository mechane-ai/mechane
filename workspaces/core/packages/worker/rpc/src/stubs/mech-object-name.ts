import type { MechObjectNameInput } from './types.ts';

/**
 * The name of a mech's object, the one place that derives it: its workspace's id and its own, so a mech id under
 * another workspace names another object. The object reads both ids from its own record, never from its name.
 */
export function mechObjectName({ workspaceId, mechId }: MechObjectNameInput): string {
  return `${workspaceId}/${mechId}`;
}
