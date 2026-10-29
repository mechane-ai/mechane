import { Duration } from 'effect';

/** Whether a watch may admit scheduled work, independently of the mech lifecycle. */
export const WatchStatus = { Active: 'active', Paused: 'paused' } as const;

export type WatchStatus = (typeof WatchStatus)[keyof typeof WatchStatus];

/** The shortest admitted interval between checks or finding notifications. */
export const WATCH_MIN_INTERVAL = Duration.minutes(5);
/** The longest admitted interval between checks or finding notifications. */
export const WATCH_MAX_INTERVAL = Duration.days(30);
/** The maximum number of saved schedules per mech. */
export const WATCHES_PER_MECH = 32;
/** The admission limit for a watch display name. */
export const WATCH_NAME_MAX_CHARS = 120;
/** The shortest admitted deadline for a running scheduled check. */
export const WATCH_MIN_CHECK_TIME = Duration.minutes(1);
/** The longest admitted deadline for a running scheduled check. */
export const WATCH_MAX_CHECK_TIME = Duration.hours(1);
/** The CLI deadline when a watch does not specify one. */
export const WATCH_DEFAULT_CHECK_TIME = Duration.minutes(5);

/** Whether the last check finished with an answer or ended without a reliable result. */
export const WatchCheckOutcome = { Completed: 'completed', Unknown: 'unknown' } as const;

export type WatchCheckOutcome = (typeof WatchCheckOutcome)[keyof typeof WatchCheckOutcome];
