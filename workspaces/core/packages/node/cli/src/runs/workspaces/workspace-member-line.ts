import type { WorkspaceMember } from '@mechane/protocol';

/** Roster entries identify principals by stable IDs alongside their display names. */
export function workspaceMemberLine({ principalId, name, role }: WorkspaceMember): string {
  return `${principalId} ${name} (${role})`;
}
