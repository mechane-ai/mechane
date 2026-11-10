import { BackgroundWork, MachineStatus, ReservationPhase } from '@mechane/sandbox-store';
import type { FileCheckpointPurpose, SandboxStore } from '@mechane/sandbox-store';
import { SandboxRecoveryCheckpointRefusalReason } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import { refuseRecoveryCheckpoint } from './refuse-recovery-checkpoint.ts';

export type RecoveryCheckpointPurpose = typeof FileCheckpointPurpose.cases.Recovery.Type;
type RecoveryFenceInput = { readonly store: SandboxStore; readonly purpose: RecoveryCheckpointPurpose };

/** A file repair never changes which guest or committed generation the operator observed. */
export function assertRecoveryCheckpointFence({ store, purpose }: RecoveryFenceInput): void {
  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== purpose.machineId || live.value.status !== MachineStatus.Ready) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.MachineUnavailable });
  }

  const state = store.workspace();
  const recovery = state.recovery;
  const head = Option.map(state.head, ({ generation }) => generation);

  const matchesRecovery = Option.exists(
    recovery,
    (value) => value.generation === purpose.recoveryGeneration && value.machineId === purpose.machineId,
  );

  if (!matchesRecovery || Option.getOrNull(head) !== Option.getOrNull(purpose.committedGeneration)) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.WorkspaceChanged });
  }

  if (maintenanceActive({ store })) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.MaintenanceActive });
  }

  const capacity = store.capacity();
  const reservation = Option.flatMap(capacity, (value) => value.reservation);
  const isAllocating = Option.exists(reservation, (value) => value.phase === ReservationPhase.Starting);

  if (isAllocating) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.MachineUnavailable });
  }

  const isStopping = Option.exists(reservation, (value) => value.phase === ReservationPhase.Stopping);
  const drain = store.machineDrain({ machineId: purpose.machineId });

  if (isStopping || Option.isSome(drain)) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.DrainActive });
  }

  const work = store.fileCheckpointWork();

  if (BackgroundWork.guards.Active(work)) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.WorkActive });
  }
}
