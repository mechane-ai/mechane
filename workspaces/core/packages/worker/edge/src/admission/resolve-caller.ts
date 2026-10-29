import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Caller } from '../types.ts';
import { bearerTokenHash } from './bearer-token-hash.ts';
import { cachedKey } from './cached-key.ts';
import type { AdmitInput } from './types.ts';

/**
 * Resolves the request's bearer key to the caller it acts for. Only the key's cache shard decides, filled from the
 * directory's record of the key's hash, and it refuses a revoked key before an expired one.
 */
export const resolveCaller = Effect.fn('resolveCaller')(function* ({
  request,
  settings,
}: AdmitInput): Effect.fn.Return<Caller, AuthenticationFailure | ObjectUnavailable> {
  const hash = yield* bearerTokenHash({ request });
  const { key, principal } = yield* cachedKey({ settings, tokenHash: hash });

  return { key, principal };
});
