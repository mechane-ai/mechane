---
name: security-oauth-browser-sessions
message: Keep OAuth tokens server-side behind host-only HttpOnly cookies with exact-origin checks.
paths: ["packages/worker/pages/src/**", "packages/worker/pages/src/github/**"]
---

## Rules

Keep OAuth access, ID, and refresh tokens out of browser JavaScript, browser storage, HTML, JSON responses, and forwarded cookies.
Let one server-side component per application own code exchange, PKCE, state and nonce validation, and refresh.
Give each application its own confidential client secret from the server's secret store, and expose only public configuration to the browser.
Keep the session in an application-specific, host-only, HttpOnly cookie with `SameSite=Strict`, `Path=/`, and a declared maximum age, and encrypt any session state the cookie carries.
Require `Secure` and the `__Host-` prefix outside loopback development.
Bind encrypted cookies to their application origin and purpose, and keep them within browser cookie size limits.
Carry the authorization callback with a short-lived, encrypted, HttpOnly `SameSite=Lax` transaction cookie, and validate state and issuer before establishing a session.

Restrict callback and return URLs to the application's own origin, and require HTTPS outside loopback.
Accept session, login, and logout requests only as `POST` with an exact same-origin `Origin` header and a custom request header, and answer them with `Cache-Control: no-store`.
Treat sibling origins under a shared parent domain as foreign.
Never let a browser request choose where the server sends a token, or supply a token for the server to use.
On authenticated API calls, reject a request whose expected account differs from the session's, attach the server-held access token, and strip browser cookies before calling the owning API.
Strip session cookies from requests forwarded to anything other than the application's session and API handlers, such as static-asset servers, and never set cookies on static-asset responses.

Reuse unexpired access tokens across reloads, and refresh only near expiry.
Cache issuer metadata and signing keys with bounded lifetimes, refetch the keys when a token names an unknown key ID, and never cache user credentials in state shared across users.
Restore a fresh page load from the session cookie, and try one non-interactive authorization only when that session is missing or invalid.
Never restart automatic authorization from a completed callback, an access denial, or a failed API request, and preserve the requested destination.
Keep signed out, access denied, and provider unavailable distinct, and never erase a valid session cookie because the provider is unreachable.

Serialize session exchanges and logout across same-origin tabs.
On sign-out, cancel queued session restoration and wait for in-flight session exchanges before clearing the cookie, so a late exchange cannot set it again.
Expire the application cookie on logout even when the revocation endpoint is unavailable, and end the central session through the discovered logout endpoint.

## Checks

After login and refresh, inspect browser storage, page HTML, JSON responses, and script-readable cookies for tokens.
Inspect the `Set-Cookie` attributes of the session and transaction cookies.
Call the session and logout endpoints from a sibling origin, without the custom header, and with `GET`, and confirm refusal.
Try callback and return URLs outside the application origin and confirm rejection.
Exercise reload, concurrent tabs, account switching, logout during refresh, and an unreachable provider in a real browser.

## Local adaptations

The Worker's pages are the one component of the GitHub OAuth web flow: they create the state, check it against the sign-in cookie, and exchange the code with the client secret that `MECHANE_GITHUB_CLIENT_SECRET` supplies.
GitHub's access token reads the signed-in user once and is dropped; no OAuth token reaches a browser, a page, a response or storage, and the session is the deployment's own.
Local deployments may instead configure `MECHANE_LOCAL_BOOTSTRAP_SECRET`. The Worker refuses that setting for a non-loopback origin. `/auth/local` accepts the secret only in a same-origin POST body, verifies it with WebCrypto, and opens the same browser session as GitHub sign-in. No URL, page or log carries the secret, and it grants no API or sandbox access directly.
Sessions identify their subject by provider and stable subject text. GitHub uses its numeric id encoded as text; local bootstrap uses provider `local` and subject `owner`, never a fabricated GitHub account. The session's name is descriptive and grants no authority.
The cookies are `mechane_session`, `SameSite=Strict` for one hour, and `mechane_sign_in`, `SameSite=Lax` for ten minutes, both host-only and `HttpOnly` with `Path=/`, and `Secure` with the `__Host-` prefix on an HTTPS origin; the Worker refuses an origin that is neither HTTPS nor a loopback host's.
Each cookie holds a random token, and the directory keeps the session or the sign-in under the token's hash, so no cookie carries state to encrypt.
GitHub returns only to the fixed `/auth/github/callback` of the deployment's origin, which then refreshes to the bare device page; no request chooses where a token goes. A sign-in stores no user code, and the device page ignores `?code=`, so no request without a session learns whether a code awaits approval.
The device form has two steps: `review`, which the typed code sends, and `approve`, which the review page's form sends. Each is a same-origin `POST` with an exact `Origin` and a CSRF token derived from the session's token, which stands in for a custom header that a form without script cannot send. Each counts against `code_attempt` for the provider-qualified identity before it reads a code. Every code that awaits no approval, unknown, expired or already decided, answers one page; the pages send `Referrer-Policy: same-origin`, since a browser posts the form with `Origin: null` under `no-referrer`.
Every page answers `Cache-Control: no-store` with a policy that loads nothing and forbids framing; an expired sign-in, a sign-in declined at GitHub, a refused code, an unreachable GitHub and a limited request, which also sends `retry-after`, each have a page of their own, and none starts another sign-in.
The browser session only approves device approvals, so no refresh, sign-out, account switch or API call exists for it yet; it expires.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
