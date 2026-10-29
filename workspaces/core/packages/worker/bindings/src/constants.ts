import { Duration } from 'effect';

/** The longest lifetime a deployment may give a new key. */
export const KEY_LIFETIME_MAX = Duration.days(365);
