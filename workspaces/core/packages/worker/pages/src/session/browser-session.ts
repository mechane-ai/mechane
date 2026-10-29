import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { tokenHash } from '@mechane/credentials';
import type { ObjectUnavailable } from '@mechane/protocol';
import { LiveSession } from '@mechane/rpc';
import { Effect, Match, Option } from 'effect';
import { CookieName } from '../constants.ts';
import type { BrowserSession } from '../types.ts';
import { readCookie } from './read-cookie.ts';

type BrowserSessionInput = { readonly request: Request; readonly settings: WorkerSettings };

/** The live browser session whose cookie the request carries; none without a cookie or once the session expired. */
export const browserSession = Effect.fn('browserSession')(function* ({
  request,
  settings,
}: BrowserSessionInput): Effect.fn.Return<Option.Option<BrowserSession>, ObjectUnavailable> {
  const token = readCookie({ request, cookie: CookieName.Session, settings });

  if (Option.isNone(token)) {
    return Option.none();
  }

  const hash = yield* tokenHash({ token: token.value });

  const session = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.liveBrowserSession({ tokenHash: hash }),
    answer: LiveSession,
  });

  return Match.valueTags(session, {
    Live: ({ provider, subject, name }) => Option.some({ token: token.value, provider, subject, name }),
    SignedOut: () => Option.none(),
  });
});
