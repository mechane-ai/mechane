import { hasPrincipalIdentity } from '@mechane/bindings';
import { IdentityNotAdmitted } from '@mechane/protocol';
import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { Effect, Option } from 'effect';
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

  if (Option.isSome(settings.allowedIdentities)) {
    const isAdmitted = yield* hasPrincipalIdentity({
      settings,
      principalId: principal.id,
      identities: settings.allowedIdentities.value,
    });

    if (!isAdmitted) {
      return yield* new IdentityNotAdmitted({});
    }
  }

  return { key, principal };
});
