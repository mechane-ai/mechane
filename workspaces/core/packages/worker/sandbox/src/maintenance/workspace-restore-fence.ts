import type { WorkspaceRestore } from '@mechane/sandbox-store';
import { ExecutionStatus } from '@mechane/sandbox-store';
import { SandboxRestoreRefusalReason } from '@mechane/sandbox-wire';
import type { SandboxRestoreRequest } from '@mechane/sandbox-wire';
import { Equal, Option } from 'effect';
import { maintenanceActive } from './maintenance-active.ts';
import { refusePortableMaintenance } from './refuse-portable-maintenance.ts';
import type { PortableMaintenanceInput, PortableStepInput } from './types.ts';

type RestoreFenceInput = Pick<PortableMaintenanceInput, 'store'> & { readonly request: SandboxRestoreRequest };
type RefusalReason = (typeof SandboxRestoreRefusalReason)[keyof typeof SandboxRestoreRefusalReason];

export function restoreFence({ store, request }: RestoreFenceInput): Option.Option<RefusalReason> {
  const state = store.workspace();

  if (Option.isNone(state.head)) {
    return Option.some(SandboxRestoreRefusalReason.MissingHead);
  }

  if (!matchesRestoreSource({ store, request })) {
    return Option.some(SandboxRestoreRefusalReason.WorkspaceChanged);
  }

  const live = store.liveMachine();
  const latest = store.latestMachine();

  if (Option.isNone(latest) || !ownsPreviousMachine({ store, request, previousMachineId: latest.value.id })) {
    return Option.some(SandboxRestoreRefusalReason.WorkspaceChanged);
  }

  if (Option.exists(live, (machine) => machine.id !== latest.value.id)) {
    return Option.some(SandboxRestoreRefusalReason.WorkspaceChanged);
  }

  const capacity = store.capacity();
  const reservation = Option.flatMap(capacity, (value) => value.reservation);

  if (
    Option.exists(reservation, (held) => held.machineId !== latest.value.id && held.machineId !== request.machineId)
  ) {
    return Option.some(SandboxRestoreRefusalReason.WorkspaceChanged);
  }

  const current = store.portableMaintenance();

  if (Option.exists(current, (job) => job.id === request.operationId)) {
    return Option.some(SandboxRestoreRefusalReason.OperationReused);
  }

  if (maintenanceActive({ store })) {
    return Option.some(SandboxRestoreRefusalReason.MaintenanceActive);
  }

  if (Option.isSome(state.checkpoint)) {
    return Option.some(SandboxRestoreRefusalReason.CheckpointActive);
  }

  const work = store.unfinishedExecutions();
  const canDispatch = work.some((execution) => execution.status === ExecutionStatus.Pending);

  if (canDispatch) {
    return Option.some(SandboxRestoreRefusalReason.WorkActive);
  }

  return Option.none();
}

type PreviousMachineInput = RestoreFenceInput & Pick<WorkspaceRestore, 'previousMachineId'>;

function ownsPreviousMachine({ store, request, previousMachineId: machineId }: PreviousMachineInput): boolean {
  if (machineId === request.machineId) {
    return true;
  }

  const current = store.portableMaintenance();
  const retained = Option.flatMap(current, (job) => store.workspaceRestore({ operationId: job.id }));

  if (Option.isNone(current) || Option.isNone(retained)) {
    return false;
  }

  const previous = retained.value;

  const sameLoss =
    previous.request.machineId === request.machineId &&
    previous.request.recoveryGeneration === request.recoveryGeneration &&
    previous.request.committedGeneration === request.committedGeneration;

  const ownsMachine = Option.contains(current.value.target, machineId) || previous.previousMachineId === machineId;

  return sameLoss && ownsMachine;
}

function matchesRestoreSource({ store, request }: RestoreFenceInput): boolean {
  const state = store.workspace();
  const headMatches = Option.exists(state.head, (head) => head.generation === request.committedGeneration);

  const recoveryMatches = Option.exists(
    state.recovery,
    (recovery) => recovery.generation === request.recoveryGeneration && recovery.machineId === request.machineId,
  );

  return headMatches && recoveryMatches;
}

/** Every asynchronous maintenance step still owns the exact saved source and loss selected at admission. */
export function requireWorkspaceRestore({ store, job }: Pick<PortableStepInput, 'store' | 'job'>): WorkspaceRestore {
  const record = store.workspaceRestore({ operationId: job.id });
  const current = store.portableMaintenance();
  const ownsMaintenance = Option.exists(current, (value) => Equal.equals(value, job));
  const latest = store.latestMachine();

  if (!ownsMaintenance || Option.isNone(record) || !matchesRestoreSource({ store, request: record.value.request })) {
    return refusePortableMaintenance({ reason: 'the selected saved files or recovery identity changed' });
  }

  const expectedMachine = Option.getOrElse(job.target, () => record.value.previousMachineId);

  if (!Option.exists(latest, (machine) => machine.id === expectedMachine)) {
    return refusePortableMaintenance({ reason: 'the restore machine identity changed' });
  }

  return record.value;
}
