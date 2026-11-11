import { MachineId, RecordId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { LiveMachineRow } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import { advanceToIdleExecution } from '../executions/advance-to-idle-execution.ts';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import { observeMachine } from '../machines/observe-machine.ts';
import { readyWorkspaceMachine } from '../machines/ready-workspace-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';
import { checkpointInactiveEnvironment } from './checkpoint-inactive-environment.ts';
import { expireFileCheckpoint } from './expire-file-checkpoint.ts';
import { runRecoveryCheckpoint } from './run-recovery-checkpoint.ts';

type RunFileCheckpointInput = WorkspaceProviderStepInput & { readonly purpose: FileCheckpointPurpose };
const CHECKPOINT_WAIT = Duration.seconds(1);

/** Commits files under a stable operation identity without creating or dispatching a shell execution. */
export async function runFileCheckpoint({
  store,
  provider,
  workspace,
  purpose,
}: RunFileCheckpointInput): Promise<FileCheckpointResult> {
  if (FileCheckpointPurpose.guards.Recovery(purpose)) {
    return await runRecoveryCheckpoint({ store, provider, workspace, purpose });
  }

  const now = DateTime.nowUnsafe();
  const operation = store.claimFileCheckpoint({ purpose, now });

  if (!FileCheckpointResult.guards.Pending(operation.result)) {
    return operation.result;
  }

  const recovery = store.workspace().recovery;

  if (FileCheckpointPurpose.guards.Activation(purpose) && Option.isSome(recovery)) {
    const result = FileCheckpointResult.cases.Failed.make({ reason: recovery.value.reason });

    store.finishFileCheckpoint({ purpose, result });

    return result;
  }

  const input = { store, provider, workspace };
  const isReady = await advanceWorkspace({ ...input, shouldAdmitCommand: false });
  const current = store.claimFileCheckpoint({ purpose, now });

  if (!isReady || !FileCheckpointResult.guards.Pending(current.result)) {
    return current.result;
  }

  const expired = expireFileCheckpoint({ store, purpose, startedAt: operation.startedAt, now });

  if (Option.isSome(expired)) {
    return expired.value;
  }

  await observeMachine(input);

  const deadline = DateTime.addDuration(now, CHECKPOINT_WAIT);

  if (!(await advanceToIdleExecution({ ...input, deadline }))) {
    return current.result;
  }

  const machine = await checkpointMachine({ ...input, purpose, deadline });

  if (FileCheckpointPurpose.guards.Drain(purpose) && Option.isSome(machine) && machine.value.id !== purpose.machineId) {
    const result = FileCheckpointResult.cases.Failed.make({
      reason: 'draining machine was replaced before checkpointing',
    });

    store.finishFileCheckpoint({ purpose, result });

    return result;
  }

  if (Option.isNone(machine)) {
    const live = store.liveMachine();

    if (FileCheckpointPurpose.guards.Activation(purpose) && Option.isNone(live)) {
      const result = checkpointInactiveEnvironment({ store });

      store.finishFileCheckpoint({ purpose, result });

      return result;
    }

    return current.result;
  }

  const state = store.workspace();
  const head = state.head;
  const capturedSequence = Option.some(state.activitySequence);
  const parent = Option.map(head, ({ generation }) => generation);
  const generation = RecordId.make(crypto.randomUUID());
  const archive = Option.none();

  store.saveCheckpoint({
    capturedSequence,
    isAborting: false,
    generation,
    parent,
    machineId: machine.value.id,
    purpose,
    startedAt: now,
    archive,
    part: 0,
  });

  return current.result;
}

type CheckpointMachineInput = RunFileCheckpointInput & { readonly deadline: DateTime.Utc };

async function checkpointMachine({
  store,
  provider,
  workspace,
  purpose,
  deadline,
}: CheckpointMachineInput): Promise<Option.Option<LiveMachineRow>> {
  if (FileCheckpointPurpose.guards.Drain(purpose) || FileCheckpointPurpose.guards.Activation(purpose)) {
    const machine = store.liveMachine();

    const isWrongDrain =
      FileCheckpointPurpose.guards.Drain(purpose) && Option.isSome(machine) && machine.value.id !== purpose.machineId;

    if (Option.isNone(machine) || isWrongDrain) {
      return machine;
    }

    const machineId = machine.value.id;
    const identity = MachineId.make(machineId);
    const drain = store.machineDrain({ machineId: identity });

    if (FileCheckpointPurpose.guards.Activation(purpose) && Option.isSome(drain)) {
      return Option.none();
    }

    const guest = await connectLiveMachine({ store, provider, machineId });

    if (Option.isNone(guest)) {
      return Option.none();
    }

    // A previous command may leave its committed snapshot fence until the next writer is admitted.
    const isReleased = await releaseWorkspace({ store, provider, workspace, machineId, guest: guest.value });

    if (!isReleased) {
      return Option.none();
    }

    return machine;
  }

  return await readyWorkspaceMachine({ store, provider, workspace, deadline });
}
