import { localSignInUrl } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Effect } from 'effect';
import type { PageRefused } from '../errors.ts';
import { renderPage } from '../html/render-page.ts';
import type { PageInput } from '../types.ts';
import { localBootstrapSecret } from './local-bootstrap-secret.ts';

/** Offers the bootstrap password form only when local owner sign-in is available. */
export const showLocalSignIn = Effect.fn('showLocalSignIn')(function* (
  input: PageInput,
): Effect.fn.Return<Response, PageRefused> {
  yield* localBootstrapSecret(input);

  const signIn = localSignInUrl({ origin: input.settings.origin });
  const action = escapeHtml({ text: signIn.href });

  const body = [
    '<p>Use the bootstrap secret file printed by your local server to sign in as its owner.</p>',
    `<form method="post" action="${action}">`,
    '<p><label>Bootstrap secret <input type="password" name="secret" autocomplete="off" required></label></p>',
    '<button type="submit">Sign in</button></form>',
  ].join('\n');

  return renderPage({ status: HttpStatusCode.Ok, title: 'Sign in locally', body, headers: [] });
});
