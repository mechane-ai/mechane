import { ModelId } from '@mechane/deployment';
import { CreationRequestRecordId, DroneId, MechId, TurnId, WatchId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** Another definition revision was saved before the caller's requested update. */
export class MechRevisionConflict extends Schema.TaggedError<MechRevisionConflict>()('MechRevisionConflict', {
  mechId: MechId,
  expectedRevision: Schema.Int,
  currentRevision: Schema.Int,
}) {}

/** The creation request ID is already retained with different inputs. */
export class MechCreationConflict extends Schema.TaggedError<MechCreationConflict>()('MechCreationConflict', {
  requestId: CreationRequestRecordId,
}) {}

/** The mech retains its history but no longer admits incoming work. */
export class MechArchived extends Schema.TaggedError<MechArchived>()('MechArchived', { mechId: MechId }) {}

/** The operator has not admitted this workspace to sandbox compute. */
export class SandboxDisabled extends Schema.TaggedError<SandboxDisabled>()('SandboxDisabled', {
  workspaceId: WorkspaceId,
}) {}

/** All machine leases allowed for this workspace are already held. */
export class SandboxCapacityReached extends Schema.TaggedError<SandboxCapacityReached>()('SandboxCapacityReached', {
  workspaceId: WorkspaceId,
}) {}

/** The addressed mech has no watch under the requested ID. */
export class WatchNotFound extends Schema.TaggedError<WatchNotFound>()('WatchNotFound', { watchId: WatchId }) {}

/** The requested schedule would exceed the maximum saved watches for this mech. */
export class WatchLimitReached extends Schema.TaggedError<WatchLimitReached>()('WatchLimitReached', {
  mechId: MechId,
}) {}

/** The deployment offers no model with this id; `offered` lists the ones it does. */
export class ModelInvalid extends Schema.TaggedError<ModelInvalid>()('ModelInvalid', {
  model: ModelId,
  offered: Schema.Array(ModelId),
}) {}

/** The mech has no turn with this id. */
export class TurnNotFound extends Schema.TaggedError<TurnNotFound>()('TurnNotFound', { turnId: TurnId }) {}

/** The turn ended before any cancel, with a reply or a reason for none, so nothing is left to cancel. */
export class TurnEnded extends Schema.TaggedError<TurnEnded>()('TurnEnded', { turnId: TurnId }) {}

/** The mech has no drone with this id. */
export class DroneNotFound extends Schema.TaggedError<DroneNotFound>()('DroneNotFound', { droneId: DroneId }) {}

/** The drone ended before any cancel, with a report or a reason for none, so nothing is left to cancel. */
export class DroneEnded extends Schema.TaggedError<DroneEnded>()('DroneEnded', { droneId: DroneId }) {}
