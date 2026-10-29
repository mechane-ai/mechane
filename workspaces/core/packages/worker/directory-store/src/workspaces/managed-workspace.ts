import { decodeFirst } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import type { Option } from 'effect';
import type { WorkspaceInput } from '../inputs.types.ts';
import { ManagedWorkspaceRow } from './schemas.ts';

/** Unknown workspace IDs remain absent so admission can return the same refusal for missing membership. */
export function managedWorkspace({ sql, workspaceId }: SqlCall<WorkspaceInput>): Option.Option<ManagedWorkspaceRow> {
  const cursor = sql.exec(
    'SELECT id, name, kind, creator_id, daily_allowance_micros, created_at_ms FROM workspaces WHERE id = ?',
    workspaceId,
  );

  return decodeFirst({ cursor, schema: ManagedWorkspaceRow });
}
