import { tokenHash } from '@mechane/credentials';
import { Effect } from 'effect';

/** What the CSRF token of a session hashes beside the session's token, so it never equals the session's own hash. */
const CSRF_CONTEXT = 'mechane approval form:';

type CsrfTokenInput = { readonly sessionToken: string };

/**
 * The CSRF token of a browser session, derived from its token, so only a page rendered for that session can hold it and
 * the directory stores nothing more.
 */
export const csrfToken = Effect.fn('csrfToken')(function* ({ sessionToken }: CsrfTokenInput): Effect.fn.Return<string> {
  return yield* tokenHash({ token: `${CSRF_CONTEXT}${sessionToken}` });
});
