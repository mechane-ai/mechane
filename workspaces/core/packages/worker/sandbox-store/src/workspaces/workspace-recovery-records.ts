import type { RecordId } from '@mechane/records';
import type { RecordsInput } from '@mechane/store';
import { Schema } from 'effect';
import { WorkspaceRecovery, WorkspaceRestoration } from './schemas.ts';

type RetireWorkspaceInput = { readonly generation: RecordId };
type FailedRestorationInput = { readonly restoration: WorkspaceRestoration; readonly reason: string };

/** Retains file recovery intent and generations that still need object cleanup. */
export function workspaceRecoveryRecords({ sql }: RecordsInput) {
  const retireWorkspace: (input: RetireWorkspaceInput) => void = ({ generation }) => {
    sql.exec('UPDATE sandbox_workspace SET checkpoint = NULL, file_checkpoint = NULL WHERE slot = 1');
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

    sql.exec(
      'UPDATE sandbox_workspace SET recovery = ?, checkpoint = NULL, file_checkpoint = NULL WHERE slot = 1',
      value,
    );
    sql.exec(
      'INSERT INTO workspace_retirements (generation) VALUES (?) ON CONFLICT (generation) DO NOTHING',
      generation,
    );
  };

  /** A lost partial copy is recoverable from its committed source; that source must never be retired. */
  const failRestoration: (input: FailedRestorationInput) => void = ({ restoration, reason }) => {
    const recoveryCodec = Schema.fromJsonString(WorkspaceRecovery);

    const value = Schema.encodeSync(recoveryCodec)({
      generation: restoration.generation,
      machineId: restoration.machineId,
      reason,
    });

    const restorationCodec = Schema.fromJsonString(WorkspaceRestoration);
    const expected = Schema.encodeSync(restorationCodec)(restoration);

    sql.exec(
      'UPDATE sandbox_workspace SET recovery = ?, restoration = NULL WHERE slot = 1 AND restoration = ?',
      value,
      expected,
    );
  };

  return { retireWorkspace, clearRetiredWorkspace, recoverWorkspace, failRestoration };
}
