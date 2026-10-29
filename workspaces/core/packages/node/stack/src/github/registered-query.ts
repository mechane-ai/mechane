import { GitHubAuthorizeQuery } from '@mechane/protocol';
import { Option, Record, Result, Schema } from 'effect';
import type { FakeRequest, LocalGitHub } from './types.ts';

/** The request whose authorization query to read, and the OAuth App it must name. */
type RegisteredQueryInput = { readonly request: FakeRequest; readonly github: LocalGitHub };

/** The authorization query, when it names the registered client and its exact callback URL, and none otherwise. */
export function registeredQuery({ request, github }: RegisteredQueryInput): Option.Option<GitHubAuthorizeQuery> {
  const query = Schema.decodeUnknownResult(GitHubAuthorizeQuery)(Record.fromEntries(request.url.searchParams));

  return Option.filter(
    Result.getSuccess(query),
    ({ clientId, redirectUri }) => clientId === github.clientId && redirectUri === github.callbackUrl,
  );
}
