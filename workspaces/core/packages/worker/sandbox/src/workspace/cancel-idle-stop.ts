import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { SandboxRecoveryAction, SandboxStopOrigin, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result } from 'effect';
import { SANDBOX_IDLE } from '../constants.ts';
import type { GuestConnection, MachineIdInput, ProviderStepInput } from '../types.ts';
import { interruptedAutomaticGeneration } from './interrupted-automatic-generation.ts';
import { releaseWorkspaceGeneration } from './release-workspace.ts';

type StopIdentityInput = MachineIdInput & { readonly store: SandboxStore; readonly receipt: SandboxStopReceipt };
type ReleaseStopFilesInput = StopIdentityInput & { readonly guest: GuestConnection };
type CancelIdleStopInput = StopIdentityInput & ProviderStepInput;

const CANCELLABLE_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Requested,
  SandboxStopPhase.WaitingForCommands,
  SandboxStopPhase.Checkpointing,
]);

export function canCancelIdleStop({ store, machineId, receipt }: StopIdentityInput): boolean {
  if (!Option.contains(receipt.machineId, machineId)) {
    return false;
  }

  const live = store.liveMachine();

  if (!Option.exists(live, (machine) => machine.id === machineId)) {
    return false;
  }

  const drain = store.machineDrain({ machineId });

  if (!Option.exists(drain, (value) => value.operationId === receipt.operationId)) {
    return false;
  }

  if (receipt.phase === SandboxStopPhase.Canceling) {
    return true;
  }

  if (receipt.origin !== SandboxStopOrigin.Idle || !CANCELLABLE_PHASES.has(receipt.phase)) {
    return false;
  }

  const requestedAt = receipt.requestedAt;
  const pending = store.latestPendingExecutionAt();

  if (
    Option.isNone(requestedAt) ||
    !Option.exists(pending, (at) => DateTime.isGreaterThanOrEqualTo(at, requestedAt.value))
  ) {
    return false;
  }

  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
  const result = store.fileCheckpointResult({ purpose });
  const active = store.workspace().checkpoint;
  const isDraining = Option.exists(active, (checkpoint) => checkpoint.purpose.operationId === receipt.operationId);

  return !isDraining && !Option.exists(result, FileCheckpointResult.guards.Failed);
}

function unstartedIdleStop({ store }: Pick<StopIdentityInput, 'store'>): Option.Option<StopIdentityInput> {
  const live = store.liveMachine();
  const drain = Option.flatMap(live, (machine) => store.machineDrain({ machineId: machine.id }));

  if (Option.isNone(drain)) {
    return Option.none();
  }

  const { machineId, operationId } = drain.value;
  const receipt = store.sandboxStop({ operationId });
  const workspace = store.workspace();

  if (Option.isNone(receipt) || !Option.contains(receipt.value.machineId, machineId)) {
    return Option.none();
  }

  const stop = receipt.value;
  const isFailedIdleStop = stop.origin === SandboxStopOrigin.Idle && stop.phase === SandboxStopPhase.Failed;
  const hasFileOwner = Option.isSome(workspace.checkpoint) || Option.isSome(workspace.recovery);

  if (!isFailedIdleStop || stop.recoveryAction !== SandboxRecoveryAction.RepairWorkspace) {
    return Option.none();
  }

  const repair = store.pendingRecoveryCheckpoint();

  if (hasFileOwner || Option.isSome(repair)) {
    return Option.none();
  }

  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId });
  const capture = store.fileCheckpointResult({ purpose });

  if (Option.exists(capture, (result) => !FileCheckpointResult.guards.Pending(result))) {
    return Option.none();
  }

  return Option.some({ store, machineId, receipt: receipt.value });
}

export async function cancelUnstartedIdleStop({ store, provider }: ProviderStepInput): Promise<void> {
  const held = unstartedIdleStop({ store });

  if (Option.isNone(held)) {
    return;
  }

  const { machineId, receipt } = held.value;
  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    return;
  }

  if (!(await releaseIdleStopFiles({ store, machineId, receipt, guest: guest.value }))) {
    return;
  }

  const current = unstartedIdleStop({ store });

  if (Option.isSome(current) && current.value.receipt.operationId === receipt.operationId) {
    finishIdleStopCancellation(current.value);
  }
}

async function releaseIdleStopFiles({ store, machineId, receipt, guest }: ReleaseStopFilesInput): Promise<boolean> {
  if (Option.isNone(receipt.generation)) {
    return true;
  }

  const generation = receipt.generation.value;
  const lease = Option.none();
  const input = { guest, machineId, generation, lease };
  const promise = releaseWorkspaceGeneration(input);
  const released = await capturePromise({ promise });

  if (Result.isSuccess(released)) {
    return released.success;
  }

  const state = store.workspace();
  const current = unstartedIdleStop({ store });
  const sameStop = Option.exists(current, (owner) => owner.receipt.operationId === receipt.operationId);

  const sameHome = Option.exists(
    state.head,
    (head) => head.generation === generation && Option.contains(head.capturedMachineId, machineId),
  );

  const orphan = interruptedAutomaticGeneration({ cause: released.failure, diagnostic: state.checkpointError });

  if (!sameStop || !sameHome || Option.isNone(orphan)) {
    return Result.getOrThrow(released);
  }

  return await releaseWorkspaceGeneration({ ...input, generation: orphan.value });
}

/** Once release can reach the guest, even a canceled command cannot turn this operation back into a stop. */
export async function cancelIdleStop({
  store,
  provider,
  machineId,
  receipt,
}: CancelIdleStopInput): Promise<SandboxStopReceipt> {
  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
  const result = store.fileCheckpointResult({ purpose });
  const committed = Option.filter(result, FileCheckpointResult.guards.Committed);

  if (Option.isNone(committed)) {
    return finishIdleStopCancellation({ store, machineId, receipt });
  }

  const generation = committed.value.generation;

  const canceling = {
    ...receipt,
    phase: SandboxStopPhase.Canceling,
    generation: Option.some(generation),
    updatedAt: DateTime.nowUnsafe(),
  };

  store.saveSandboxStop(canceling);

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return canceling;
  }

  const lease = Option.none();
  const released = await releaseWorkspaceGeneration({ guest: guest.value, machineId, generation, lease });

  if (!released) {
    return canceling;
  }

  return finishIdleStopCancellation({ store, machineId, receipt: canceling });
}

function finishIdleStopCancellation({ store, machineId, receipt }: StopIdentityInput): SandboxStopReceipt {
  if (receipt.origin === SandboxStopOrigin.Explicit) {
    return replaceReleasedDrain({ store, machineId, receipt });
  }

  const now = DateTime.nowUnsafe();
  const idleAt = DateTime.addDuration(now, SANDBOX_IDLE);

  const canceled = {
    ...receipt,
    phase: SandboxStopPhase.Canceled,
    updatedAt: now,
    recoveryAction: SandboxRecoveryAction.None,
  };

  store.atomic({
    run: () => {
      const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
      const checkpoint = store.fileCheckpointResult({ purpose });

      if (Option.exists(checkpoint, FileCheckpointResult.guards.Pending)) {
        const result = FileCheckpointResult.cases.Failed.make({ reason: 'New work canceled the idle stop' });

        store.finishFileCheckpoint({ purpose, result });
      }

      store.clearMachineDrain({ machineId });
      store.saveSandboxStop(canceled);
      store.setSandboxIdleAt({ at: idleAt });
    },
  });

  return canceled;
}

/** The prior freeze can already have reached release, so an explicit stop needs a fresh drain. */
function replaceReleasedDrain({ store, machineId, receipt }: StopIdentityInput): SandboxStopReceipt {
  return store.atomic({
    run: () => {
      store.clearMachineDrain({ machineId });

      const drain = store.requestMachineDrain({ machineId });

      const requested = {
        ...receipt,
        drainOperationId: drain.operationId,
        phase: SandboxStopPhase.Requested,
        updatedAt: DateTime.nowUnsafe(),
      };

      store.saveSandboxStop(requested);

      return requested;
    },
  });
}
