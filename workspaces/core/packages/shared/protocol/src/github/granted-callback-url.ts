import { Schema } from 'effect';
import { GitHubGrantedCallback } from './schemas.ts';

/** The callback a sign-in names, and the authorization code and state GitHub returns to it. */
type GrantedCallbackUrlInput = GitHubGrantedCallback & { readonly redirectUri: string };

/** The callback with which GitHub returns a browser once its person signed in, carrying the code and the state. */
export function grantedCallbackUrl({ redirectUri, authorizationCode, state }: GrantedCallbackUrlInput): string {
  const url = new URL(redirectUri);
  const fields = Schema.encodeSync(GitHubGrantedCallback)({ authorizationCode, state });

  url.search = new URLSearchParams(fields).toString();

  return url.href;
}
