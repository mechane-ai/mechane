import type { SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import { WorkspaceKind } from './constants.ts';
import type { SharedWorkspaceInput } from './types.ts';

/** The creator and stable workspace ID bind later retries to the original creation intent. */
export function insertSharedWorkspace({
  sql,
  id,
  name,
  principalId,
  dailyAllowanceMicros,
  now,
}: SqlCall<SharedWorkspaceInput>): void {
  const createdAtMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO workspaces (id, name, kind, creator_id, daily_allowance_micros, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    name,
    WorkspaceKind.Shared,
    principalId,
    dailyAllowanceMicros,
    createdAtMs,
  );
}
