import type { SecureOrigin } from '@mechane/deployment';
import { Schema } from 'effect';
import { GitHubPath } from './constants.ts';
import { GitHubAuthorizeQuery } from './schemas.ts';

/** GitHub's web origin, and the OAuth App, callback and state the authorization query names. */
type AuthorizeUrlInput = GitHubAuthorizeQuery & { readonly githubWebOrigin: SecureOrigin };

/** The GitHub page that signs a browser in and returns it, with `state`, to `redirectUri`. */
export function authorizeUrl({ githubWebOrigin, clientId, redirectUri, state }: AuthorizeUrlInput): URL {
  const url = new URL(GitHubPath.Authorize, githubWebOrigin);
  const fields = Schema.encodeSync(GitHubAuthorizeQuery)({ clientId, redirectUri, state });

  url.search = new URLSearchParams(fields).toString();

  return url;
}
