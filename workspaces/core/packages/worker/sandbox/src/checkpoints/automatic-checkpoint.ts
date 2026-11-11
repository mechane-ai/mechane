import { RecordId, SandboxOperationId } from '@mechane/records';
import { AUTOMATIC_CHECKPOINT_INTERVAL, FileCheckpointPurpose, MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import { AUTOMATIC_CHECKPOINT_QUIET } from '../constants.ts';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';

/** One pending snapshot coalesces activity; a live machine can also have writers with no new tool admission. */
export async function prepareAutomaticCheckpoint({
  store,
  provider,
  workspace,
}: WorkspaceProviderStepInput): Promise<void> {
  const input = { store, provider, workspace };
  const state = store.workspace();
  const machine = store.liveMachine();
  const active = store.activeExecution();

  if (Option.isSome(state.checkpoint) || Option.isSome(state.recovery) || maintenanceActive({ store })) {
    return;
  }

  if (Option.isNone(machine) || machine.value.status !== MachineStatus.Ready || Option.isSome(active)) {
    return;
  }

  const drain = store.machineDrain({ machineId: machine.value.id });

  if (Option.isSome(drain) || Option.isNone(state.automaticAt)) {
    return;
  }

  const now = DateTime.nowUnsafe();
  const isDue = DateTime.isGreaterThanOrEqualTo(now, state.automaticAt.value);

  const isQuiet = Option.exists(state.lastActivityAt, (at) => {
    const quietAt = DateTime.addDuration(at, AUTOMATIC_CHECKPOINT_QUIET);

    return DateTime.isGreaterThanOrEqualTo(now, quietAt);
  });

  const hasPendingActivity = Option.match(state.head, {
    onNone: () => state.activitySequence > 0,
    onSome: (head) => !Option.contains(head.capturedSequence, state.activitySequence),
  });

  const isQuietActivityReady = isQuiet && hasPendingActivity && Option.isNone(state.checkpointError);

  if (!isDue && !isQuietActivityReady) {
    return;
  }

  const guest = await input.provider.connect({ machineId: machine.value.id });

  if (
    Option.isNone(guest) ||
    !(await releaseWorkspace({ ...input, guest: guest.value, machineId: machine.value.id }))
  ) {
    return;
  }

  const current = store.workspace();
  const live = store.liveMachine();
  const currentDrain = store.machineDrain({ machineId: machine.value.id });
  const currentExecution = store.activeExecution();

  const isWorkspaceBusy =
    Option.isSome(current.checkpoint) || Option.isSome(current.recovery) || maintenanceActive({ store });

  const isMachineBusy = Option.isSome(currentDrain) || Option.isSome(currentExecution);
  const isSameMachine = Option.exists(live, (value) => value.id === machine.value.id);

  if (isWorkspaceBusy || isMachineBusy || !isSameMachine) {
    return;
  }

  const generation = RecordId.make(crypto.randomUUID());
  const operationId = SandboxOperationId.make(generation);
  const purpose = FileCheckpointPurpose.cases.Automatic.make({ operationId });
  const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_INTERVAL);

  const parent = Option.map(current.head, (head) => head.generation);
  const archive = Option.none();
  const capturedSequence = Option.some(current.activitySequence);

  store.saveCheckpoint({
    generation,
    purpose,
    machineId: machine.value.id,
    parent,
    archive,
    part: 0,
    startedAt: now,
    capturedSequence,
    isAborting: false,
  });
  store.scheduleAutomaticCheckpoint({ at, error: current.checkpointError });
}
