import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { ExecutionStatus } from '../constants.ts';
import { commitWorkspace } from './commit-workspace.ts';
import { WorkspaceCheckpoint, WorkspaceRestoration } from './schemas.ts';
import type { WorkspaceSnapshot } from './schemas.ts';
import { workspaceBindings } from './workspace-bindings.ts';
import { workspaceRecoveryRecords } from './workspace-recovery-records.ts';

type WorkspaceRecords = ReturnType<typeof workspaceBindings> &
  ReturnType<typeof workspaceRecoveryRecords> & {
    readonly saveCheckpoint: (input: WorkspaceCheckpoint) => void;
    readonly saveRestoration: (input: WorkspaceRestoration) => void;
    readonly commitWorkspace: (input: WorkspaceSnapshot) => void;
  };

/** The head advances in the same transaction as its execution receipt. Retired data stays named until deletion. */
export function workspaceRecords({ sql }: RecordsInput): WorkspaceRecords {
  const saveCheckpoint: WorkspaceRecords['saveCheckpoint'] = (input) => {
    const codec = Schema.fromJsonString(WorkspaceCheckpoint);
    const value = Schema.encodeSync(codec)(input);

    sql.exec(
      'UPDATE sandbox_workspace SET checkpoint = ? WHERE slot = 1 AND EXISTS (SELECT 1 FROM executions WHERE id = ? AND machine_id = ? AND status = ?)',
      value,
      input.executionId,
      input.machineId,
      ExecutionStatus.Dispatched,
    );
  };

  const saveRestoration: WorkspaceRecords['saveRestoration'] = (input) => {
    const codec = Schema.fromJsonString(WorkspaceRestoration);
    const value = Schema.encodeSync(codec)(input);

    sql.exec('UPDATE sandbox_workspace SET restoration = ? WHERE slot = 1', value);
  };

  return {
    ...workspaceBindings({ sql }),
    saveCheckpoint,
    saveRestoration,
    commitWorkspace: (input) => commitWorkspace({ sql, ...input }),
    ...workspaceRecoveryRecords({ sql }),
  };
}
