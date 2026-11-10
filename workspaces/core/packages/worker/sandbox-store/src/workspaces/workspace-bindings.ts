import { RecordId, RecordText } from '@mechane/records';
import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import {
  CommandCheckpoint,
  FileCheckpoint,
  WorkspaceRecovery,
  WorkspaceRestoration,
  WorkspaceSnapshot,
} from './schemas.ts';
import type { WorkspaceCheckpoint } from './schemas.ts';

/** The selected provider and all durable workspace transfer and recovery state. */
const StoredWorkspaceState = Schema.Struct({
  /** Absent until the sandbox first chooses its provider. */
  provider: Schema.OptionFromNullOr(RecordText),
  /** Absent until the first checkpoint commits. */
  head: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceSnapshot)),
  /** Absent when no settled command awaits a portable save. */
  checkpoint: Schema.OptionFromNullOr(Schema.fromJsonString(CommandCheckpoint)),
  /** Absent when no explicit file operation is being checkpointed. */
  fileCheckpoint: Schema.OptionFromNullOr(Schema.fromJsonString(FileCheckpoint)),
  /** Absent before any committed generation is restored. */
  restoration: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRestoration)),
  /** Absent when every obsolete generation has been deleted. */
  retired: Schema.OptionFromNullOr(RecordId),
  /** Absent unless failed file work requires recovery; the committed head remains authoritative. */
  recovery: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRecovery)),
});

type WorkspaceState = Omit<typeof StoredWorkspaceState.Type, 'checkpoint' | 'fileCheckpoint'> & {
  /** Absent when neither a command nor a file operation owns a transfer. */
  readonly checkpoint: Option.Option<WorkspaceCheckpoint>;
};

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
      'SELECT provider, head, checkpoint, file_checkpoint AS fileCheckpoint, restoration, recovery, (SELECT generation FROM workspace_retirements ORDER BY rowid LIMIT 1) AS retired FROM sandbox_workspace WHERE slot = 1',
    );

    const { checkpoint, fileCheckpoint, ...state } = decodeOne({ cursor, schema: StoredWorkspaceState });
    const transfer = Option.orElse(checkpoint, () => fileCheckpoint);

    return { ...state, checkpoint: transfer };
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
