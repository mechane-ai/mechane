import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { ExecutionStatus } from '../constants.ts';
import { commitWorkspace } from './commit-workspace.ts';
import { fileCheckpointRecords } from './file-checkpoint-records.ts';
import { CommandCheckpoint, FileCheckpoint, WorkspaceRestoration } from './schemas.ts';
import type { WorkspaceCheckpoint, WorkspaceSnapshot } from './schemas.ts';
import { workspaceBindings } from './workspace-bindings.ts';
import { workspaceRecoveryRecords } from './workspace-recovery-records.ts';

type WorkspaceRecords = ReturnType<typeof workspaceBindings> &
  ReturnType<typeof fileCheckpointRecords> &
  ReturnType<typeof workspaceRecoveryRecords> & {
    readonly saveCheckpoint: (input: WorkspaceCheckpoint) => void;
    readonly saveRestoration: (input: WorkspaceRestoration) => void;
    readonly commitWorkspace: (input: WorkspaceSnapshot) => void;
  };

/** The head advances in the same transaction as its execution receipt. Retired data stays named until deletion. */
export function workspaceRecords({ sql }: RecordsInput): WorkspaceRecords {
  const saveCheckpoint: WorkspaceRecords['saveCheckpoint'] = (input) => {
    if (!('executionId' in input)) {
      const codec = Schema.fromJsonString(FileCheckpoint);
      const value = Schema.encodeSync(codec)(input);

      sql.exec(
        'UPDATE sandbox_workspace SET file_checkpoint = ? WHERE slot = 1 AND checkpoint IS NULL AND NOT EXISTS (SELECT 1 FROM executions WHERE status = ?)',
        value,
        ExecutionStatus.Dispatched,
      );

      return;
    }

    const codec = Schema.fromJsonString(CommandCheckpoint);
    const value = Schema.encodeSync(codec)(input);

    sql.exec(
      'UPDATE sandbox_workspace SET checkpoint = ? WHERE slot = 1 AND file_checkpoint IS NULL AND EXISTS (SELECT 1 FROM executions WHERE id = ? AND machine_id = ? AND status = ?)',
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
    ...fileCheckpointRecords({ sql }),
    saveCheckpoint,
    saveRestoration,
    commitWorkspace: (input) => commitWorkspace({ sql, ...input }),
    ...workspaceRecoveryRecords({ sql }),
  };
}
