import { BYTES_PER_KIBIBYTE } from './constants.ts';

/** Publication captures at most this many decoded file bytes in one immutable intent. */
export const SOURCE_PATCH_MAX_BYTES = 512 * BYTES_PER_KIBIBYTE;
/** Publication limits file count independently of total content size. */
export const SOURCE_PATCH_MAX_FILES = 256;
/** Repository-relative paths are bounded before guest or GitHub requests. */
export const SOURCE_PATH_MAX_CHARS = 1024;
/** A grant bounds the number of owner-approved write prefixes. */
export const SOURCE_GRANT_MAX_PATHS = 64;
/** Publication permits regular files only; executable mode remains meaningful to Git. */
export const SourceFileMode = { File: '100644', Executable: '100755' } as const;
export type SourceFileMode = (typeof SourceFileMode)[keyof typeof SourceFileMode];

/** This grant prefix includes every otherwise permitted repository path. */
export const SOURCE_ROOT_PATH = '.';
/** The wire bound leaves room for base64 padding; decoded content has a separate aggregate limit. */
export const SOURCE_BASE64_EXPANSION_FACTOR = 2;
