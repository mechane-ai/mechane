import { MechId, TurnId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** Service-authenticated operational control; this route cannot override saved workspace policy. */
export const MECH_MAINTENANCE_PATH = '/internal/mechs/maintenance';
/** Quiesce preserves admitted work; resume rechecks current authority and recovery fences. */
export const MechMaintenanceAction = { Quiesce: 'quiesce', Resume: 'resume' } as const;
/** The current native owner state exposed to maintenance callers. */
export const MechRuntimeStatus = { Idle: 'idle', Running: 'running', Paused: 'paused', Quiesced: 'quiesced' } as const;
const PendingCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** One explicit maintenance decision for a scoped mech. */
export const MechMaintenanceRequest = Schema.Struct({
  workspaceId: WorkspaceId,
  mechId: MechId,
  action: Schema.Enum(MechMaintenanceAction),
});

export type MechMaintenanceRequest = typeof MechMaintenanceRequest.Type;

/** Durable owner and recovery state observed after the maintenance decision. */
export const MechMaintenanceReceipt = Schema.Struct({
  workspaceId: WorkspaceId,
  mechId: MechId,
  activeRevision: Schema.Int,
  /** None when no native activation owns the mech. */
  turnId: Schema.OptionFromNullOr(TurnId),
  status: Schema.Enum(MechRuntimeStatus),
  admittedSequence: PendingCount,
  observedSequence: PendingCount,
  pendingNativeTaskCount: PendingCount,
  pendingEffectCount: PendingCount,
  isCheckpointRequired: Schema.Boolean,
  isImportComplete: Schema.Boolean,
  canResume: Schema.Boolean,
});

export type MechMaintenanceReceipt = typeof MechMaintenanceReceipt.Type;
