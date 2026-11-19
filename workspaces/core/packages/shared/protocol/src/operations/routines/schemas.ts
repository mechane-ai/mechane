import {
  MechId,
  PAGE_RENAMES,
  RecordId,
  RecordName,
  RecordText,
  renamedWireStruct,
  TurnId,
  wireStruct,
} from '@mechane/records';
import { Duration, Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { NotificationId } from '../notifications/schemas.ts';

const ROUTINE_MIN_SECONDS = Duration.toSeconds(Duration.minutes(1));
const ROUTINE_MAX_DAYS = 30;
const ROUTINE_MAX_SECONDS = Duration.toSeconds(Duration.days(ROUTINE_MAX_DAYS));

/** A deleted routine retains its identity and evidence while refusing future delivery. */
const RoutineStatus = { Enabled: 'enabled', Disabled: 'disabled', Deleted: 'deleted' } as const;

/** A caller retains this UUID when retrying a recurring notification configuration. */
export const RoutineId = RecordId.pipe(Schema.brand('RoutineId'));
export type RoutineId = typeof RoutineId.Type;

/** Revision zero names absence; each accepted change increments the saved revision. */
const RoutineRevision = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));

/** Intervals are bounded to prevent accidental rapid paid work or unsupported deadlines. */
export const RoutineInterval = Schema.Int.check(
  Schema.isBetween({ minimum: ROUTINE_MIN_SECONDS, maximum: ROUTINE_MAX_SECONDS }),
);

export type RoutineInterval = typeof RoutineInterval.Type;

/** A saved routine distinguishes a due slot, durable inbox admission, and actual model observation. */
export const Routine = wireStruct({
  fields: {
    id: RoutineId,
    mechId: MechId,
    revision: RoutineRevision,
    name: RecordName,
    text: RecordText,
    everySeconds: RoutineInterval,
    status: Schema.Enum(RoutineStatus),
    createdAt: WireTime,
    updatedAt: WireTime,
    anchorAt: WireTime,
    /** None while future delivery is disabled or deleted. */
    nextDueAt: Schema.OptionFromNullOr(WireTime),
    /** None before the first interval is admitted. */
    lastDueAt: Schema.OptionFromNullOr(WireTime),
    /** None before the first interval commits to the inbox. */
    lastDeliveredAt: Schema.OptionFromNullOr(WireTime),
    /** None before any routine notification is accepted. */
    lastNotificationId: Schema.OptionFromNullOr(NotificationId),
    /** None until a prepared model context includes a routine notification. */
    lastObservedAt: Schema.OptionFromNullOr(WireTime),
    /** None until a prepared model context includes a due slot. */
    lastObservedDueAt: Schema.OptionFromNullOr(WireTime),
    /** None before a routine notification is included in model context. */
    lastObservedNotificationId: Schema.OptionFromNullOr(NotificationId),
    /** None before a model activation observes a routine notification. */
    lastObservedRunId: Schema.OptionFromNullOr(TurnId),
  },
});

export type Routine = typeof Routine.Type;

/** Pages include deletion receipts so a delayed retry cannot recreate a removed revision. */
export const RoutineList = renamedWireStruct({
  fields: {
    routines: Schema.Array(Routine),
    hasMore: Schema.Boolean,
    /** None when no later routine remains in this collection. */
    nextAfter: Schema.OptionFromNullOr(RoutineId),
  },
  renames: PAGE_RENAMES,
});

export type RoutineList = typeof RoutineList.Type;
