import type { SandboxOperationId } from '@mechane/records';
import { MachineId } from '@mechane/records';
import { SandboxRestoreRequest, SandboxRestoreResult } from '@mechane/sandbox-wire';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { WorkspaceRecovery, WorkspaceSnapshot } from './schemas.ts';

export const WorkspaceRestore = Schema.Struct({
  request: Schema.toType(SandboxRestoreRequest),
  recovery: WorkspaceRecovery,
  source: WorkspaceSnapshot,
  previousMachineId: MachineId,
  shouldRetainArtifacts: Schema.Boolean,
  result: SandboxRestoreResult,
});

export type WorkspaceRestore = typeof WorkspaceRestore.Type;
type RestoreIdentity = { readonly operationId: SandboxOperationId };
type FinishRestore = RestoreIdentity & Pick<WorkspaceRestore, 'result'>;

type WorkspaceRestoreTable = {
  readonly workspaceRestore: (input: RestoreIdentity) => Option.Option<WorkspaceRestore>;
  readonly claimWorkspaceRestore: (input: WorkspaceRestore) => void;
  readonly finishWorkspaceRestore: (input: FinishRestore) => void;
  readonly clearRestoredRecovery: (input: SandboxRestoreRequest) => void;
  readonly retireRestoreArtifacts: () => void;
};

const RestoreJson = Schema.fromJsonString(WorkspaceRestore);
const RestoreRow = Schema.Struct({ record: RestoreJson });

/** Immutable intent and original loss evidence survive later maintenance and current-recovery clearing. */
export function workspaceRestoreRecords({ sql }: RecordsInput): WorkspaceRestoreTable {
  function workspaceRestore({ operationId }: RestoreIdentity): Option.Option<WorkspaceRestore> {
    const cursor = sql.exec('SELECT record FROM workspace_restores WHERE operation_id = ?', operationId);
    const row = decodeFirst({ cursor, schema: RestoreRow });

    return Option.map(row, ({ record }) => record);
  }

  function claimWorkspaceRestore({ ...input }: WorkspaceRestore): void {
    const record = Schema.encodeSync(RestoreJson)(input);

    sql.exec(
      'INSERT INTO workspace_restores (operation_id, record) VALUES (?, ?) ON CONFLICT DO NOTHING',
      input.request.operationId,
      record,
    );
  }

  function finishWorkspaceRestore({ operationId, result }: FinishRestore): void {
    const codec = Schema.fromJsonString(SandboxRestoreResult);
    const encoded = Schema.encodeSync(codec)(result);

    sql.exec(
      "UPDATE workspace_restores SET record = json_set(record, '$.result', json(?)) WHERE operation_id = ? AND json_extract(record, '$.result._tag') = 'Pending'",
      encoded,
      operationId,
    );
  }

  function clearRestoredRecovery({ recoveryGeneration, machineId, committedGeneration }: SandboxRestoreRequest): void {
    sql.exec(
      "UPDATE sandbox_workspace SET recovery = NULL WHERE slot = 1 AND json_extract(recovery, '$.generation') = ? AND json_extract(recovery, '$.machineId') = ? AND json_extract(head, '$.generation') = ?",
      recoveryGeneration,
      machineId,
      committedGeneration,
    );
  }

  function retireRestoreArtifacts(): void {
    sql.exec(
      "INSERT INTO workspace_retirements (generation) SELECT DISTINCT json_extract(record, '$.recovery.generation') FROM workspace_restores WHERE json_extract(record, '$.shouldRetainArtifacts') = 1 ON CONFLICT (generation) DO NOTHING",
    );
    sql.exec(
      "UPDATE workspace_restores SET record = json_set(record, '$.shouldRetainArtifacts', json('false')) WHERE json_extract(record, '$.shouldRetainArtifacts') = 1",
    );
  }

  return {
    workspaceRestore,
    claimWorkspaceRestore,
    finishWorkspaceRestore,
    clearRestoredRecovery,
    retireRestoreArtifacts,
  };
}
