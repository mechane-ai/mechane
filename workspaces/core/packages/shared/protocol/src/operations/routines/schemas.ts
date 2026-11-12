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
import { MechName } from '../mechs/schemas.ts';
import { NotificationId, NotificationText } from '../notifications/schemas.ts';

const ROUTINE_MIN_SECONDS = Duration.toSeconds(Duration.minutes(1));
const ROUTINE_MAX_DAYS = 30;
const ROUTINE_MAX_SECONDS = Duration.toSeconds(Duration.days(ROUTINE_MAX_DAYS));

/** A deleted routine retains its identity and evidence while refusing future delivery. */
export const RoutineStatus = { Enabled: 'enabled', Disabled: 'disabled', Deleted: 'deleted' } as const;

/** A caller retains this UUID when retrying a recurring notification configuration. */
export const RoutineId = RecordId.pipe(Schema.brand('RoutineId'));
export type RoutineId = typeof RoutineId.Type;

/** Revision zero names absence; each accepted change increments the saved revision. */
export const RoutineRevision = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));
export type RoutineRevision = typeof RoutineRevision.Type;

/** Intervals are bounded to prevent accidental rapid paid work or unsupported deadlines. */
const RoutineInterval = Schema.Int.check(
  Schema.isBetween({ minimum: ROUTINE_MIN_SECONDS, maximum: ROUTINE_MAX_SECONDS }),
);

/** The current revision must leave room for the next accepted change. */
export const ExpectedRoutineRevision = RoutineRevision.check(Schema.isLessThan(Number.MAX_SAFE_INTEGER));
export type ExpectedRoutineRevision = typeof ExpectedRoutineRevision.Type;

/** Full desired configuration; enabling starts a fresh absolute cadence for this revision. */
export const RoutineRequest = wireStruct({
  fields: {
    expectedRevision: ExpectedRoutineRevision,
    name: MechName,
    text: NotificationText,
    everySeconds: RoutineInterval,
    isEnabled: Schema.Boolean,
  },
});

export type RoutineRequest = typeof RoutineRequest.Type;

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
