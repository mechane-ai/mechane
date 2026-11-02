import { callDirectory, hasPrincipalIdentity } from '@mechane/bindings';
import { tokenHash } from '@mechane/credentials';
import { isIdentityListed } from '@mechane/deployment';
import { IdentityNotAdmitted, KeyMissing } from '@mechane/protocol';
import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { HttpHeader, HttpMethod, Micros } from '@mechane/records';
import { SessionPrincipal } from '@mechane/rpc';
import { Effect, Match, Option } from 'effect';
import { bearerTokenHash } from './bearer-token-hash.ts';
import { browserSession } from './browser-session.ts';
import { cachedKey } from './cached-key.ts';
import { requireBrowserOrigin } from './require-browser-origin.ts';
import type { AuthenticateInput, Caller } from './types.ts';

/**
 * The key cache decides credential validity, refusing revocation before expiry. Installation admission separately
 * checks the principal's current provider identities, so a cached credential cannot preserve withdrawn access.
 */
export const resolveCaller = Effect.fn('resolveCaller')(function* ({
  request,
  settings,
}: AuthenticateInput): Effect.fn.Return<Caller, AuthenticationFailure | ObjectUnavailable> {
  if (!request.headers.has(HttpHeader.Authorization)) {
    return yield* resolveBrowserCaller({ request, settings });
  }

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

  return { key: Option.some(key), principal };
});

const resolveBrowserCaller = Effect.fn('resolveBrowserCaller')(function* ({
  request,
  settings,
}: AuthenticateInput): Effect.fn.Return<Caller, AuthenticationFailure | ObjectUnavailable> {
  const session = yield* browserSession({ request, settings });

  if (Option.isNone(session)) {
    return yield* new KeyMissing();
  }

  if (request.method !== HttpMethod.Get) {
    yield* requireBrowserOrigin({ request, settings });
  }

  if (
    Option.isSome(settings.allowedIdentities) &&
    !isIdentityListed({ identity: session.value, identities: settings.allowedIdentities.value })
  ) {
    return yield* new IdentityNotAdmitted({});
  }

  const hash = yield* tokenHash({ token: session.value.token });

  const dailyAllowanceMicros = Micros.make(settings.dailyAllowanceMicros);

  const resolved = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.sessionPrincipal({ tokenHash: hash, dailyAllowanceMicros }),
    answer: SessionPrincipal,
  });

  const key = Option.none();

  return yield* Match.valueTags(resolved, {
    SignedIn: ({ principal }) => Effect.succeed({ principal, key }),
    SignedOut: () => new KeyMissing(),
  });
});
