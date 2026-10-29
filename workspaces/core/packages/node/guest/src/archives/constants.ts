import { Duration } from 'effect';

/** The maximum time allowed for a guest archive operation. */
export const WORKSPACE_TRANSFER_TIMEOUT = Duration.minutes(5);
/** The compressed tar filename stored outside the workspace home. */
export const ARCHIVE_FILE = 'archive.tar.gz';
