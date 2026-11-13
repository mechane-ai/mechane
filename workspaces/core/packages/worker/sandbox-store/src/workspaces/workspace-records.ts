import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Duration, Option, Schema } from 'effect';
import { commitWorkspace } from './commit-workspace.ts';
import type { CommitWorkspaceInput } from './commit-workspace.ts';
import { fileCheckpointRecords } from './file-checkpoint-records.ts';
import { WorkspaceCheckpoint, WorkspaceRestoration } from './schemas.ts';
import { workspaceBindings } from './workspace-bindings.ts';
import { workspaceRecoveryRecords } from './workspace-recovery-records.ts';
import { workspaceRestoreRecords } from './workspace-restore-records.ts';

type WorkspaceActivityInput = { readonly now: DateTime.Utc };
type ScheduleAutomaticInput = { readonly at: DateTime.Utc; readonly error: Option.Option<string> };
type SaveCheckpointInput = Omit<WorkspaceCheckpoint, 'lease'>;
export const AUTOMATIC_CHECKPOINT_INTERVAL = Duration.minutes(1);

type WorkspaceRecords = ReturnType<typeof workspaceBindings> &
  ReturnType<typeof fileCheckpointRecords> &
  ReturnType<typeof workspaceRestoreRecords> &
  ReturnType<typeof workspaceRecoveryRecords> & {
    readonly noteWorkspaceActivity: ({ now }: WorkspaceActivityInput) => void;
    readonly scheduleAutomaticCheckpoint: ({ at, error }: ScheduleAutomaticInput) => void;
    readonly saveCheckpoint: ({ ...input }: SaveCheckpointInput) => void;
    readonly saveRestoration: (input: WorkspaceRestoration) => void;
    readonly clearRestoration: (input: WorkspaceRestoration) => void;
    readonly commitWorkspace: ({ ...input }: CommitWorkspaceInput) => void;
  };

/** Files advance independently of terminal command receipts; retired data stays named until deletion. */
export function workspaceRecords({ sql }: RecordsInput): WorkspaceRecords {
  const saveCheckpoint: WorkspaceRecords['saveCheckpoint'] = (input) => {
    const codec = Schema.fromJsonString(WorkspaceCheckpoint);

    sql.exec(
      "UPDATE sandbox_workspace SET checkpoint_lease = checkpoint_lease + CASE WHEN file_checkpoint IS NULL OR json_extract(file_checkpoint, '$.generation') <> ? THEN 1 ELSE 0 END WHERE slot = 1",
      input.generation,
    );

    const cursor = sql.exec('SELECT checkpoint_lease AS lease FROM sandbox_workspace WHERE slot = 1');
    const schema = Schema.Struct({ lease: Schema.Int });
    const { lease } = decodeOne({ cursor, schema });
    const value = Schema.encodeSync(codec)({ ...input, lease });

    sql.exec('UPDATE sandbox_workspace SET file_checkpoint = ? WHERE slot = 1 AND checkpoint IS NULL', value);
  };

  const saveRestoration: WorkspaceRecords['saveRestoration'] = (input) => {
    const codec = Schema.fromJsonString(WorkspaceRestoration);
    const value = Schema.encodeSync(codec)(input);

    sql.exec('UPDATE sandbox_workspace SET restoration = ? WHERE slot = 1', value);
  };

  const clearRestoration: WorkspaceRecords['clearRestoration'] = (input) => {
    const codec = Schema.fromJsonString(WorkspaceRestoration);
    const value = Schema.encodeSync(codec)(input);

    sql.exec('UPDATE sandbox_workspace SET restoration = NULL WHERE slot = 1 AND restoration = ?', value);
  };

  return {
    ...workspaceBindings({ sql }),
    ...fileCheckpointRecords({ sql }),
    noteWorkspaceActivity: ({ now }) => {
      const at = DateTime.toEpochMillis(now);
      const automatic = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_INTERVAL);
      const automaticAt = DateTime.toEpochMillis(automatic);

      sql.exec(
        'UPDATE sandbox_workspace SET activity_sequence = activity_sequence + 1, last_activity_at_ms = ?, automatic_at_ms = COALESCE(automatic_at_ms, ?) WHERE slot = 1',
        at,
        automaticAt,
      );
    },
    scheduleAutomaticCheckpoint: ({ at, error }) => {
      const timestamp = DateTime.toEpochMillis(at);
      const text = Option.getOrNull(error);

      sql.exec(
        'UPDATE sandbox_workspace SET automatic_at_ms = ?, checkpoint_error = ? WHERE slot = 1',
        timestamp,
        text,
      );
    },
    saveCheckpoint,
    saveRestoration,
    clearRestoration,
    commitWorkspace: (input) => commitWorkspace({ sql, ...input }),
    ...workspaceRecoveryRecords({ sql }),
    ...workspaceRestoreRecords({ sql }),
  };
}
