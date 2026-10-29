import { Duration } from 'effect';

/** How long a client may keep a file that the next release or deploy replaces, such as `cli/latest.json`. */
export const REPLACED_FILE_LIFETIME = Duration.minutes(1);
