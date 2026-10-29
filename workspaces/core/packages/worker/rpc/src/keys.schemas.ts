import { DirectoryPrincipal } from '@mechane/records';
import { Schema } from 'effect';
import { DirectoryKey } from './directory.schemas.ts';

/** The cases of a shard's judgment of a key it holds, each by its tag. */
const JUDGED_KEY_CASES = {
  Resolved: { key: DirectoryKey, principal: DirectoryPrincipal },
  Revoked: {},
  Expired: { expiresAt: Schema.DateTimeUtcFromMillis },
} as const;

/**
 * How a shard judged a key it holds: the key and its principal, or why it refuses the key, revoked before expired,
 * since revocation is final.
 */
export const JudgedKey = Schema.TaggedUnion(JUDGED_KEY_CASES);

export type JudgedKey = typeof JudgedKey.Type;

/** A shard's answer for a token's hash: its judgment of the key, or no row for it yet, which the directory fills. */
export const CachedResolution = Schema.TaggedUnion({ ...JUDGED_KEY_CASES, Missing: {} });

export type CachedResolution = typeof CachedResolution.Type;
