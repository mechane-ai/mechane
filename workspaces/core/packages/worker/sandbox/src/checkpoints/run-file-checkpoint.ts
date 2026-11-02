import { RecordId } from '@mechane/records';
import { ExecutionStatus, FileCheckpointResult } from '@mechane/sandbox-store';
import type { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { askGuest } from '../executions/ask-guest.ts';
import { observeMachine } from '../machines/observe-machine.ts';
import { readyWorkspaceMachine } from '../machines/ready-workspace-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';

type RunFileCheckpointInput = WorkspaceProviderStepInput & { readonly purpose: FileCheckpointPurpose };
const CHECKPOINT_WAIT = Duration.seconds(1);

/** Commits files under a stable operation identity without creating or dispatching a shell execution. */
export async function runFileCheckpoint({
  store,
  provider,
  workspace,
  purpose,
}: RunFileCheckpointInput): Promise<FileCheckpointResult> {
  const now = DateTime.nowUnsafe();
  const operation = store.claimFileCheckpoint({ purpose, now });

  if (!FileCheckpointResult.guards.Pending(operation.result)) {
    return operation.result;
  }

  const input = { store, provider, workspace };
  const isReady = await advanceWorkspace(input);
  const current = store.claimFileCheckpoint({ purpose, now });

  if (!isReady || !FileCheckpointResult.guards.Pending(current.result)) {
    return current.result;
  }

  const expiresAt = DateTime.addDuration(operation.startedAt, WORKSPACE_OPERATION_TIMEOUT);

  if (DateTime.isGreaterThanOrEqualTo(now, expiresAt)) {
    const result = FileCheckpointResult.cases.Failed.make({
      reason: 'file checkpoint exceeded its five minute deadline',
    });

    store.finishFileCheckpoint({ purpose, result });

    return result;
  }

  await observeMachine(input);

  const deadline = DateTime.addDuration(now, CHECKPOINT_WAIT);
  const active = store.activeExecution();

  if (Option.isSome(active) && active.value.status === ExecutionStatus.Dispatched) {
    await askGuest({ ...input, execution: active.value, deadline });

    return current.result;
  }

  const machine = await readyWorkspaceMachine({ ...input, deadline });

  if (Option.isNone(machine)) {
    return current.result;
  }

  const head = store.workspace().head;
  const parent = Option.map(head, ({ generation }) => generation);
  const generation = RecordId.make(crypto.randomUUID());
  const archive = Option.none();

  store.saveCheckpoint({ generation, parent, machineId: machine.value.id, purpose, startedAt: now, archive, part: 0 });

  return current.result;
}
