import type { RecordId } from '@mechane/records';
import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { WorkspaceRecovery } from './schemas.ts';

type RetireWorkspaceInput = { readonly generation: RecordId };

/** Retains failed live workspaces and records generations that still need object cleanup. */
export function workspaceRecoveryRecords({ sql }: RecordsInput) {
  const retireWorkspace: (input: RetireWorkspaceInput) => void = ({ generation }) => {
    sql.exec('UPDATE sandbox_workspace SET checkpoint = NULL WHERE slot = 1');
    sql.exec(
      'INSERT INTO workspace_retirements (generation) VALUES (?) ON CONFLICT (generation) DO NOTHING',
      generation,
    );
  };

  const clearRetiredWorkspace: (input: RetireWorkspaceInput) => void = ({ generation }) => {
    sql.exec('DELETE FROM workspace_retirements WHERE generation = ?', generation);
  };

  const recoverWorkspace: (input: WorkspaceRecovery) => void = ({ generation, machineId, reason }) => {
    const codec = Schema.fromJsonString(WorkspaceRecovery);
    const value = Schema.encodeSync(codec)({ generation, machineId, reason });

    sql.exec('UPDATE sandbox_workspace SET recovery = ?, checkpoint = NULL WHERE slot = 1', value);
    sql.exec(
      'INSERT INTO workspace_retirements (generation) VALUES (?) ON CONFLICT (generation) DO NOTHING',
      generation,
    );
  };

  return { retireWorkspace, clearRetiredWorkspace, recoverWorkspace };
}
