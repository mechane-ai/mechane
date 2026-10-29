import { BYTES_PER_KIBIBYTE } from '@mechane/records';

/** The longest path a memory may have, in characters: the listing every request of its mech sends names it. */
export const MEMORY_PATH_MAX_CHARS = 128;

/**
 * A memory's path: lowercase segments of letters, digits, `.`, `_` and `-` joined by `/`. Each segment starts with a
 * letter or a digit, so none is empty, `.` or `..`, and a path never needs escaping in markup.
 */
export const MEMORY_PATH_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

/** The longest text a memory may hold, in bytes of UTF-8: small enough that one tool result reads it whole. */
export const MEMORY_TEXT_MAX_BYTES = 16 * BYTES_PER_KIBIBYTE;

/** The most memories a mech keeps, since its prompt lists every one in every request. */
export const MEMORIES_PER_MECH = 64;
