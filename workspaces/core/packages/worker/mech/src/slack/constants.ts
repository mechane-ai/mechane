import { Duration } from 'effect';

/** The delay between bounded attempts to find an uncertain write in history. */
export const SLACK_RECONCILE_DELAY = Duration.minutes(5);
/** The first recovery deadline, persisted before network activity begins. */
export const SLACK_FIRST_RECONCILIATION_DELAY = Duration.seconds(15);
