import {
  DurationFromSeconds,
  MechId,
  PAGE_RENAMES,
  RecordId,
  RecordText,
  renamedWireStruct,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { NotificationId, NotificationText } from '../notifications/schemas.ts';

/** Transient credential supplied to the current mech computer, never a member login key. */
export const SELF_TOKEN_VARIABLE = 'MECHANE_SELF_TOKEN';

/** Immutable identity of one explicitly scheduled future notification. */
export const WakeId = RecordId.pipe(Schema.brand('WakeId'));
export type WakeId = typeof WakeId.Type;
/** Whether a future notification is waiting, cancelled, or durably admitted. */
export const WakeStatus = { Scheduled: 'scheduled', Cancelled: 'cancelled', Delivered: 'delivered' } as const;

/** Stored schedule with its actual delivery receipt, independent of an active model turn. */
export const Wake = wireStruct({
  fields: {
    id: WakeId,
    mechId: MechId,
    status: Schema.Enum(WakeStatus),
    text: RecordText,
    createdAt: WireTime,
    dueAt: WireTime,
    /** None until a cancellation commits. */
    canceledAt: Schema.OptionFromNullOr(WireTime),
    /** None until the scheduled notification commits to the inbox. */
    deliveredAt: Schema.OptionFromNullOr(WireTime),
    /** None before the scheduled notification is admitted. */
    notificationId: Schema.OptionFromNullOr(NotificationId),
  },
});

export type Wake = typeof Wake.Type;

/** One page of stored schedules, ordered by their immutable identity. */
export const WakeList = renamedWireStruct({
  fields: {
    wakes: Schema.Array(Wake),
    hasMore: Schema.Boolean,
    /** None when no later schedule is available. */
    nextAfter: Schema.OptionFromNullOr(WakeId),
  },
  renames: PAGE_RENAMES,
});

export type WakeList = typeof WakeList.Type;

const PositiveSeconds = Schema.Int.check(Schema.isGreaterThan(0));
const WakeDelay = PositiveSeconds.pipe(Schema.decodeTo(DurationFromSeconds));

export const WakeRequest = renamedWireStruct({
  fields: { text: NotificationText, after: Schema.optionalKey(WakeDelay), at: Schema.optionalKey(WireTime) },
  renames: { after: 'after_seconds' },
});

export type WakeRequest = typeof WakeRequest.Type;

export const SelfMessageRequest = Schema.Struct({
  text: NotificationText,
  presentation: Schema.optionalKey(UnknownFields),
});

export type SelfMessageRequest = typeof SelfMessageRequest.Type;
