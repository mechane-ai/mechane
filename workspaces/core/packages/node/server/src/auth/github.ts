import { GitHubTokenAnswer, GitHubUser } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { AuthenticationConfiguration } from '@mechane/runtime';
import { Redacted, Schema } from 'effect';
import { AuthPageError } from './page.ts';

const GITHUB_TIMEOUT_MS = 20_000;
type ExchangeCode = { readonly configuration: AuthenticationConfiguration; readonly code: string };

async function githubJson(request: Request): Promise<unknown> {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });

    if (!response.ok) {
      throw new AuthPageError('GitHub could not complete sign-in. Try again.', HttpStatusCode.Unavailable);
    }

    return await response.json();
  } catch (failure) {
    if (failure instanceof AuthPageError) {
      throw failure;
    }

    throw new AuthPageError('GitHub is unavailable. Try signing in again.', HttpStatusCode.Unavailable);
  }
}

export async function exchangeGithubCode({ configuration, code }: ExchangeCode): Promise<GitHubUser> {
  const callback = new URL('/auth/github/callback', configuration.origin);

  const body = new URLSearchParams({
    client_id: configuration.githubClientId,
    client_secret: configuration.githubClientSecret,
    code,
    redirect_uri: callback.href,
  });

  const tokenRequest = new Request(new URL('/login/oauth/access_token', configuration.githubWebOrigin), {
    method: HttpMethod.Post,
    headers: { accept: MediaType.Json },
    body,
  });

  const tokenJson = await githubJson(tokenRequest);
  const token = decodeTokenResponse(tokenJson);

  if ('error' in token) {
    throw new AuthPageError('GitHub did not authorize this sign-in. Try again.', HttpStatusCode.Forbidden);
  }

  const userRequest = new Request(new URL('/user', configuration.githubApiOrigin), {
    headers: {
      accept: MediaType.GitHubJson,
      authorization: `Bearer ${Redacted.value(token.accessToken)}`,
      [HttpHeader.UserAgent]: 'mechane',
      [HttpHeader.GitHubApiVersion]: '2022-11-28',
    },
  });

  const userJson = await githubJson(userRequest);

  try {
    return Schema.decodeUnknownSync(GitHubUser)(userJson);
  } catch {
    throw new AuthPageError('GitHub returned an invalid account. Try again.', HttpStatusCode.Unavailable);
  }
}

function decodeTokenResponse(value: unknown): GitHubTokenAnswer {
  try {
    return Schema.decodeUnknownSync(GitHubTokenAnswer)(value);
  } catch {
    throw new AuthPageError('GitHub returned an invalid sign-in response. Try again.', HttpStatusCode.Unavailable);
  }
}
