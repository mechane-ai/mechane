import type { SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { WorkspaceSnapshot } from './schemas.ts';

/** Advances the durable head and queues the previous generation for deletion within the caller transaction. */
export function commitWorkspace({ sql, generation, parent, archive }: SqlCall<WorkspaceSnapshot>): void {
  const codec = Schema.fromJsonString(WorkspaceSnapshot);
  const value = Schema.encodeSync(codec)({ generation, parent, archive });
  const retired = Option.getOrNull(parent);

  sql.exec('UPDATE sandbox_workspace SET head = ?, checkpoint = NULL, recovery = NULL WHERE slot = 1', value);
  sql.exec(
    'INSERT INTO workspace_retirements (generation) SELECT ? WHERE ? IS NOT NULL ON CONFLICT (generation) DO NOTHING',
    retired,
    retired,
  );
}
