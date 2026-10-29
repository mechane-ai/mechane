import { RecordId, RecordText } from '@mechane/records';
import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { WorkspaceCheckpoint, WorkspaceRecovery, WorkspaceRestoration, WorkspaceSnapshot } from './schemas.ts';

/** The selected provider and all durable workspace transfer and recovery state. */
const WorkspaceState = Schema.Struct({
  /** Absent until the sandbox first chooses its provider. */
  provider: Schema.OptionFromNullOr(RecordText),
  /** Absent until the first checkpoint commits. */
  head: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceSnapshot)),
  /** Absent when no settled command awaits a portable save. */
  checkpoint: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceCheckpoint)),
  /** Absent before any committed generation is restored. */
  restoration: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRestoration)),
  /** Absent when every obsolete generation has been deleted. */
  retired: Schema.OptionFromNullOr(RecordId),
  /** Absent unless a failed checkpoint left live files awaiting recovery. */
  recovery: Schema.OptionFromNullOr(Schema.fromJsonString(WorkspaceRecovery)),
});

type WorkspaceState = typeof WorkspaceState.Type;

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
      'SELECT provider, head, checkpoint, restoration, recovery, (SELECT generation FROM workspace_retirements ORDER BY rowid LIMIT 1) AS retired FROM sandbox_workspace WHERE slot = 1',
    );

    return decodeOne({ cursor, schema: WorkspaceState });
  };

  const bindProvider: WorkspaceBindings['bindProvider'] = ({ provider }) => {
    sql.exec('UPDATE sandbox_workspace SET provider = ? WHERE slot = 1 AND provider IS NULL', provider);
  };

  const replaceProvider: WorkspaceBindings['replaceProvider'] = ({ provider }) => {
    sql.exec('UPDATE sandbox_workspace SET provider = ? WHERE slot = 1', provider);
  };

  const clearWorkspace: WorkspaceBindings['clearWorkspace'] = () => {
    sql.exec(
      'UPDATE sandbox_workspace SET head = NULL, checkpoint = NULL, restoration = NULL, recovery = NULL WHERE slot = 1',
    );
  };

  return { workspace, bindProvider, replaceProvider, clearWorkspace };
}
