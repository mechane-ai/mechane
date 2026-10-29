import { PrincipalId, PrintableName, RecordText, SlackBindingId, WatchId, wireStruct } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { InboxText } from '../inbox/schemas.ts';
import {
  WATCH_MAX_CHECK_TIME,
  WATCH_MAX_INTERVAL,
  WATCH_MIN_CHECK_TIME,
  WATCH_MIN_INTERVAL,
  WATCH_NAME_MAX_CHARS,
  WatchCheckOutcome,
  WatchStatus,
} from './constants.ts';

/** A short display name admitted when saving a watch. */
export const WatchName = PrintableName.check(Schema.isBetweenLength(1, WATCH_NAME_MAX_CHARS));

export type WatchName = typeof WatchName.Type;

/** A whole-second schedule or cooldown within the admitted bounds. */
export const WatchIntervalSeconds = Schema.Int.check(
  Schema.isBetween({
    minimum: Duration.toSeconds(WATCH_MIN_INTERVAL),
    maximum: Duration.toSeconds(WATCH_MAX_INTERVAL),
  }),
);

export type WatchIntervalSeconds = typeof WatchIntervalSeconds.Type;

/** A whole-second execution deadline within the admitted bounds. */
export const WatchCheckSeconds = Schema.Int.check(
  Schema.isBetween({
    minimum: Duration.toSeconds(WATCH_MIN_CHECK_TIME),
    maximum: Duration.toSeconds(WATCH_MAX_CHECK_TIME),
  }),
);

export type WatchCheckSeconds = typeof WatchCheckSeconds.Type;

/** Whole seconds stored by a schedule, independent of current admission bounds. */
const StoredWatchSeconds = Schema.Int;

const WATCH_CONFIGURATION_FIELDS = {
  name: WatchName,
  prompt: InboxText,
  intervalSeconds: WatchIntervalSeconds,
  status: Schema.Enum(WatchStatus),
  notificationBindingId: Schema.OptionFromNullOr(SlackBindingId),
  cooldownSeconds: WatchIntervalSeconds,
  maxCheckSeconds: WatchCheckSeconds,
} as const;

/** The complete configuration admitted when saving a watch. */
export const WatchConfiguration = wireStruct({ fields: WATCH_CONFIGURATION_FIELDS });

export type WatchConfiguration = typeof WatchConfiguration.Type;

/** Persisted watch fields whose readers do not inherit current admission limits. */
export const WATCH_RECORD_FIELDS = {
  id: WatchId,
  ...WATCH_CONFIGURATION_FIELDS,
  name: RecordText,
  prompt: RecordText,
  intervalSeconds: StoredWatchSeconds,
  cooldownSeconds: StoredWatchSeconds,
  maxCheckSeconds: StoredWatchSeconds,
  nextRunAt: WireTime,
  creatorId: PrincipalId,
  createdAt: WireTime,
  updatedAt: WireTime,
  /** Absent until a check finishes or reaches its deadline. */
  lastCheckOutcome: Schema.OptionFromNullOr(Schema.Enum(WatchCheckOutcome)),
  /** Absent until a check finishes or reaches its deadline. */
  lastCheckedAt: Schema.OptionFromNullOr(WireTime),
} as const;

/** A saved schedule with its next deadline and latest completed or unknown outcome. */
export const Watch = wireStruct({ fields: WATCH_RECORD_FIELDS });

export type Watch = typeof Watch.Type;

/** The saved schedules returned for one mech. */
export const WatchList = Schema.Struct({ watches: Schema.Array(Watch) });

export type WatchList = typeof WatchList.Type;
