import { Duration } from 'effect';

/**
 * How soon the alarm wakes a mech again once it is armed before work starts, so work an eviction cut off resumes, and
 * an open that failed is started again.
 */
export const HEARTBEAT = Duration.minutes(1);
