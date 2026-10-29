import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Duration } from 'effect';

const REMOTE_TIMEOUT = Duration.seconds(30);
/** One deadline bounds initialization, discovery, and the remote invocation. */
export const REMOTE_TIMEOUT_MS = Duration.toMillis(REMOTE_TIMEOUT);
/** Metadata and tool results share the same bounded model-visible payload size. */
export const REMOTE_RESULT_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
