import { decodeRows } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import type { WorkspaceInput } from '../inputs.types.ts';
import { WorkspaceMemberRow } from './schemas.ts';

/** Membership listings join current principals and keep grant order stable across role changes. */
export function workspaceMembers({ sql, workspaceId }: SqlCall<WorkspaceInput>): ReadonlyArray<WorkspaceMemberRow> {
  const cursor = sql.exec(
    'SELECT memberships.principal_id, principals.name, memberships.role, memberships.created_at_ms FROM memberships JOIN principals ON principals.id = memberships.principal_id WHERE memberships.workspace_id = ? ORDER BY memberships.created_at_ms, memberships.rowid',
    workspaceId,
  );

  return decodeRows({ cursor, schema: WorkspaceMemberRow });
}
