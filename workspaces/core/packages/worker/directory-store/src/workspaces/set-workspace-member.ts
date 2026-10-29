import type { SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { SetWorkspaceMemberInput } from './types.ts';

/** Role changes preserve the time that membership was first granted. */
export function setWorkspaceMember({
  sql,
  workspaceId,
  principalId,
  role,
  now,
}: SqlCall<SetWorkspaceMemberInput>): void {
  const createdAtMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO memberships (workspace_id, principal_id, role, created_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT (principal_id, workspace_id) DO UPDATE SET role = excluded.role',
    workspaceId,
    principalId,
    role,
    createdAtMs,
  );
}
