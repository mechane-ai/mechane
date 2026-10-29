import type { SqlCall } from '@mechane/store';
import type { WorkspaceMembershipInput } from '../inputs.types.ts';

/** Membership deletion leaves the principal and its login keys intact. */
export function removeWorkspaceMember({ sql, workspaceId, principalId }: SqlCall<WorkspaceMembershipInput>): void {
  sql.exec('DELETE FROM memberships WHERE workspace_id = ? AND principal_id = ?', workspaceId, principalId);
}
