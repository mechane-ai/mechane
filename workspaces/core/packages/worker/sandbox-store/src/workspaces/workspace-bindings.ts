import { RecordId, RecordText, Sequence } from '@mechane/records';
import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { WorkspaceCheckpoint, WorkspaceRecovery, WorkspaceRestoration, WorkspaceSnapshot } from './schemas.ts';

/** The selected provider and all durable workspace transfer and recovery state. */
const StoredWorkspaceState = Schema.Struct({
  /** Absent until the sandbox first chooses its provider. */
  provider: Schema.OptionFromNullOr(RecordText),
  activitySequence: Sequence,
  lastActivityAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  automaticAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  checkpointError: Schema.OptionFromNullOr(RecordText),
  /** Absent until the first checkpoint commits. */
  head: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceSnapshot)),
  /** Absent when no file generation is being captured or uploaded. */
  checkpoint: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceCheckpoint)),
  /** Absent before any committed generation is restored. */
  restoration: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRestoration)),
  /** Absent when every obsolete generation has been deleted. */
  retired: Schema.OptionFromNullOr(RecordId),
  /** Absent unless failed file work requires recovery; the committed head remains authoritative. */
  recovery: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRecovery)),
});

type WorkspaceState = typeof StoredWorkspaceState.Type;

type BindProviderInput = { readonly provider: string };

type WorkspaceBindings = {
  readonly workspace: () => WorkspaceState;
  readonly bindProvider: (input: BindProviderInput) => void;
  readonly replaceProvider: (input: BindProviderInput) => void;
  readonly clearWorkspace: () => void;
};

/** Reads the portable workspace journal and permanently binds its selected provider. */
export function workspaceBindings({ sql }: RecordsInput): WorkspaceBindings {
  const workspace: WorkspaceBindings['workspace'] = () => {
    const cursor = sql.exec(
      "SELECT provider, activity_sequence AS activitySequence, last_activity_at_ms AS lastActivityAt, automatic_at_ms AS automaticAt, checkpoint_error AS checkpointError, head, file_checkpoint AS checkpoint, restoration, recovery, (SELECT generation FROM workspace_retirements WHERE generation IS NOT json_extract(sandbox_workspace.recovery, '$.generation') AND generation NOT IN (SELECT json_extract(record, '$.recovery.generation') FROM workspace_restores WHERE json_extract(record, '$.shouldRetainArtifacts') = 1) ORDER BY rowid LIMIT 1) AS retired FROM sandbox_workspace WHERE slot = 1",
    );

    return decodeOne({ cursor, schema: StoredWorkspaceState });
  };

  const bindProvider: WorkspaceBindings['bindProvider'] = ({ provider }) => {
    sql.exec('UPDATE sandbox_workspace SET provider = ? WHERE slot = 1 AND provider IS NULL', provider);
  };

  const replaceProvider: WorkspaceBindings['replaceProvider'] = ({ provider }) => {
    sql.exec('UPDATE sandbox_workspace SET provider = ? WHERE slot = 1', provider);
  };

  const clearWorkspace: WorkspaceBindings['clearWorkspace'] = () => {
    sql.exec(
      'UPDATE sandbox_workspace SET head = NULL, checkpoint = NULL, file_checkpoint = NULL, restoration = NULL, recovery = NULL WHERE slot = 1',
    );
  };

  return { workspace, bindProvider, replaceProvider, clearWorkspace };
}
