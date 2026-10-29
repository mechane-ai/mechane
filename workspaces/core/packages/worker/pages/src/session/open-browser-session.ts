import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { issueToken, tokenHash } from '@mechane/credentials';
import { TokenPrefix } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import type { BrowserIdentity } from '@mechane/records';
import { Duration, Effect, Schema } from 'effect';
import { COOKIE_LIFETIME, CookieName } from '../constants.ts';
import type { PageRefused } from '../errors.ts';
import { signedInPage } from '../sign-in/signed-in-page.ts';
import { requireIdentityAdmission } from './require-identity-admission.ts';

type OpenBrowserSessionInput = { readonly settings: WorkerSettings; readonly identity: BrowserIdentity };

/** Stores the new session token's hash and returns the browser cookie for the verified identity. */
export const openBrowserSession = Effect.fn('openBrowserSession')(function* ({
  settings,
  identity,
}: OpenBrowserSessionInput): Effect.fn.Return<Response, ObjectUnavailable | PageRefused> {
  yield* requireIdentityAdmission({ settings, identity });

  const lifetimeMs = Duration.toMillis(COOKIE_LIFETIME[CookieName.Session]);
  const sessionToken = issueToken({ prefix: TokenPrefix.Session });
  const sessionTokenHash = yield* tokenHash({ token: sessionToken });
  const session = { tokenHash: sessionTokenHash, ...identity };

  yield* callDirectory({
    settings,
    call: ({ directory }) => directory.openBrowserSession({ session, lifetimeMs }),
    answer: Schema.Undefined,
  });

  return signedInPage({ settings, name: identity.name, sessionToken });
});
