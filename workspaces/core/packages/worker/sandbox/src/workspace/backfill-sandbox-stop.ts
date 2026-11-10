import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxRecoveryAction, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';

type StoreInput = { readonly store: SandboxStore };
type DrainIdentity = ReturnType<SandboxStore['requestMachineDrain']>;
type BackfillStopInput = StoreInput & { readonly drain: DrainIdentity };

/** A retained drain already names its stop; inspection must not replace that identity. */
export function backfillSandboxStop({ store, drain }: BackfillStopInput): SandboxStopReceipt {
  const previous = store.sandboxStop({ operationId: drain.operationId });

  if (Option.isSome(previous)) {
    return previous.value;
  }

  const state = store.workspace();
  const purpose = FileCheckpointPurpose.cases.Drain.make(drain);
  const checkpoint = store.fileCheckpointResult({ purpose });
  const phase = drainStopPhase({ store, checkpoint });

  const receipt: SandboxStopReceipt = {
    ...drain,
    machineId: Option.some(drain.machineId),
    requestedAt: Option.none(),
    updatedAt: DateTime.nowUnsafe(),
    generation: Option.map(state.head, ({ generation }) => generation),
    lastError: Option.none(),
    recoveryAction: SandboxRecoveryAction.Wait,
    phase,
  };

  const recovery = state.recovery;

  const failure: Option.Option<string> = (() => {
    if (Option.isSome(recovery)) {
      return Option.some(recovery.value.reason);
    }

    if (Option.isSome(checkpoint) && FileCheckpointResult.guards.Failed(checkpoint.value)) {
      return Option.some(checkpoint.value.reason);
    }

    return Option.none();
  })();

  if (Option.isSome(failure)) {
    const reason = failure.value.slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();
    const lastError = Option.some(reason);

    return store.claimSandboxStop({
      ...receipt,
      phase: SandboxStopPhase.Failed,
      lastError,
      recoveryAction: SandboxRecoveryAction.RepairWorkspace,
    });
  }

  return store.claimSandboxStop(receipt);
}

/** Passive status also exposes a drain admitted before durable Stop receipts existed. */
export function inspectSandboxStop({ store }: StoreInput): Option.Option<SandboxStopReceipt> {
  const machine = store.latestMachine();
  const drain = Option.flatMap(machine, ({ id }) => store.machineDrain({ machineId: id }));

  if (Option.isSome(drain)) {
    const receipt = backfillSandboxStop({ store, drain: drain.value });

    return Option.some(receipt);
  }

  return store.latestSandboxStop();
}

type DrainPhaseInput = StoreInput & { readonly checkpoint: Option.Option<FileCheckpointResult> };

function drainStopPhase({ store, checkpoint }: DrainPhaseInput): SandboxStopReceipt['phase'] {
  if (Option.isSome(checkpoint) && FileCheckpointResult.guards.Committed(checkpoint.value)) {
    return SandboxStopPhase.Stopping;
  }

  const transfer = store.workspace().checkpoint;

  if (Option.isSome(transfer)) {
    return SandboxStopPhase.Checkpointing;
  }

  const execution = store.activeExecution();

  if (Option.isSome(execution)) {
    return SandboxStopPhase.WaitingForCommands;
  }

  return SandboxStopPhase.Requested;
}
