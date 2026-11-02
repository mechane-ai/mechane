import { cookieHeader, CookieName, readCookie, requireBrowserOrigin } from '@mechane/authentication';
import { callDirectory } from '@mechane/bindings';
import { tokenHash } from '@mechane/credentials';
import { PagePath } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Duration, Effect, Option, Schema } from 'effect';
import { NO_STORE, PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import type { PageFailure, PageInput } from '../types.ts';

/** Revokes the server session and clears its cookie before returning to the console. */
export const signOut = Effect.fn('signOut')(function* ({
  request,
  settings,
}: PageInput): Effect.fn.Return<Response, PageFailure> {
  yield* requireBrowserOrigin({ request, settings }).pipe(
    Effect.mapError(() => new PageRefused({ refusal: PageRefusal.ForgedForm })),
  );

  const token = readCookie({ request, settings, cookie: CookieName.Session });

  if (Option.isSome(token)) {
    const hash = yield* tokenHash({ token: token.value });

    yield* callDirectory({
      settings,
      call: ({ directory }) => directory.closeBrowserSession({ tokenHash: hash }),
      answer: Schema.Undefined,
    });
  }

  const clearedCookie = cookieHeader({ settings, cookie: CookieName.Session, value: '', lifetime: Duration.zero });

  return new Response(null, {
    status: HttpStatusCode.SeeOther,
    headers: {
      [HttpHeader.Location]: PagePath.Console,
      [HttpHeader.CacheControl]: NO_STORE,
      [HttpHeader.SetCookie]: clearedCookie,
    },
  });
});
