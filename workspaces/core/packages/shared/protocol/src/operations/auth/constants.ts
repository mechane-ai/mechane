/** What a device approval issues: the CLI's own login key, or a named key for an agent or CI. */
export const KeyPurpose = { Login: 'login', Named: 'named' } as const;

export type KeyPurpose = (typeof KeyPurpose)[keyof typeof KeyPurpose];

/** The longest name a key may have. */
export const KEY_NAME_MAX_CHARS = 64;

/** The prefix of each kind of secret token the deployment issues, so a person or a scanner recognizes one. */
export const TokenPrefix = { Key: 'mk_', Poll: 'mkp_', Session: 'mks_', SignIn: 'mki_' } as const;

export type TokenPrefix = (typeof TokenPrefix)[keyof typeof TokenPrefix];

/** The HTTP authorization scheme with which a request carries a Mechane key. */
export const BEARER_SCHEME = 'Bearer';

/** How many random bytes follow a token's prefix, as URL-safe base64 without padding. */
export const TOKEN_RANDOM_BYTES = 32;

/** The bytes base64 writes as one group of characters. */
const BYTES_PER_BASE64_GROUP = 3;

/** The characters base64 writes for one group of bytes. */
const BASE64_CHARS_PER_GROUP = 4;

/** The source of the pattern of a token's random part: the URL-safe base64 of its bytes, without padding. */
const TOKEN_RANDOM_PATTERN = `[A-Za-z0-9_-]{${Math.ceil((TOKEN_RANDOM_BYTES * BASE64_CHARS_PER_GROUP) / BYTES_PER_BASE64_GROUP)}}`;

/** A Mechane key: its prefix, then its random part. */
export const KEY_TOKEN_PATTERN: Readonly<RegExp> = new RegExp(`^${TokenPrefix.Key}${TOKEN_RANDOM_PATTERN}$`);

/** A device approval's poll token: its prefix, then its random part. */
export const POLL_TOKEN_PATTERN: Readonly<RegExp> = new RegExp(`^${TokenPrefix.Poll}${TOKEN_RANDOM_PATTERN}$`);

/** The letters of a user code: consonants only, so no code spells a word and no two letters look alike. */
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

/** The letters of each group of a user code, such as `BCDF` of `BCDF-GHJK`. */
export const USER_CODE_GROUP_CHARS = 4;

/** The groups of letters a user code joins with a hyphen, such as `BCDF-GHJK`. */
export const USER_CODE_GROUPS = 2;

/** A user code: two groups of the alphabet's letters joined by a hyphen, such as `BCDF-GHJK`. */
export const USER_CODE_PATTERN: Readonly<RegExp> = new RegExp(
  `^[${USER_CODE_ALPHABET}]{${USER_CODE_GROUP_CHARS}}-[${USER_CODE_ALPHABET}]{${USER_CODE_GROUP_CHARS}}$`,
);

/** The state of a device approval that a poll reports. */
export const PollStatus = { Pending: 'pending', Approved: 'approved' } as const;

export type PollStatus = (typeof PollStatus)[keyof typeof PollStatus];
