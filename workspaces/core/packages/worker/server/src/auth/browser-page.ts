import { BrowserAuthenticationPath } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { randomBytes } from 'node:crypto';
import { authPage } from './page.ts';

const SCRIPT_NONCE_BYTES = 16;
type BrowserAuthenticationPageInput = { readonly isSigningOut: boolean };

export function browserAuthenticationPage({ isSigningOut }: BrowserAuthenticationPageInput): Response {
  const scriptNonce = randomBytes(SCRIPT_NONCE_BYTES).toString('base64url');
  const scriptMarkup = `<script type="module" nonce="${scriptNonce}" src="${BrowserAuthenticationPath.Script}"></script>`;
  const headers = new Headers({ [HttpHeader.ReferrerPolicy]: 'no-referrer' });
  const status = '<p id="authentication-status" role="status">Waiting to continue…</p>';

  const unavailable =
    '<noscript><p>Authentication requires JavaScript and a browser that supports Web Locks.</p></noscript>';

  if (isSigningOut) {
    return authPage({
      title: 'Sign out',
      content: `${status}<form id="authentication-form" method="post" action="${BrowserAuthenticationPath.SignOut}"><button type="submit">Sign out</button></form>${unavailable}${scriptMarkup}`,
      headers,
      scriptNonce,
    });
  }

  return authPage({ title: 'Signing in', content: `${status}${unavailable}${scriptMarkup}`, headers, scriptNonce });
}
