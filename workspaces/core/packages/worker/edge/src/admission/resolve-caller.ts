import { hasPrincipalIdentity } from '@mechane/bindings';
import { IdentityNotAdmitted } from '@mechane/protocol';
import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { Caller } from '../types.ts';
import { bearerTokenHash } from './bearer-token-hash.ts';
import { cachedKey } from './cached-key.ts';
import type { AdmitInput } from './types.ts';

/**
 * The key cache decides credential validity, refusing revocation before expiry. Installation admission separately
 * checks the principal's current provider identities, so a cached credential cannot preserve withdrawn access.
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
