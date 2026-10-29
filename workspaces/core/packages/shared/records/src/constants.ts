/** A text with no control character, which a terminal prints as it reads, such as a name a person chose. */
export const PRINTABLE_PATTERN = /^\P{Cc}*$/u;

/**
 * The longest text a record's field holds, in UTF-16 code units: SQLite's 2 MB limit on a Durable Object's row. No
 * stored text exceeds it, since a text's UTF-16 length never exceeds its UTF-8 bytes. Only a request bounds a text
 * below it, so a later deployment may raise a request's limit without breaking an older reader.
 */
export const RECORD_TEXT_MAX_CHARS = 2_000_000;

/** The version of a random UUID, the only kind of id a caller makes for a record. */
export const RANDOM_UUID_VERSION = 4;

/** A SHA-256 digest as lowercase hex. */
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** The prefixes that name a boolean field, which its wire key drops: `isSelfGrading` travels as `self_grading`. */
export const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'was', 'needs'] as const;

/**
 * The wire keys of a page's fields that `wireKey` cannot derive. A page's `hasMore` travels as `has_more`, the name
 * list pages use elsewhere, where the derivation would drop its prefix and write `more`.
 */
export const PAGE_RENAMES = { hasMore: 'has_more' } as const;

/** The bytes of a kibibyte, the unit a size of 1,024 bytes or more is counted in, such as `50 * BYTES_PER_KIBIBYTE`. */
export const BYTES_PER_KIBIBYTE = 1024;

/** The bytes of a mebibyte, 1,024 kibibytes. */
export const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
