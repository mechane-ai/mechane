import { HttpHeader, MediaType } from '@mechane/records';
import { Redacted } from 'effect';
import type { GitHubAuthorization } from '../types.ts';

/** GitHub's REST contract selected for all integration requests. */
const GITHUB_API_VERSION = '2026-03-10';

/** Shared authenticated REST headers for token issuance and repository operations. */
export function githubHeaders({ token }: Pick<GitHubAuthorization, 'token'>): Headers {
  const authorization = githubAuthorization({ token });

  return new Headers({
    [HttpHeader.Authorization]: authorization,
    [HttpHeader.Accept]: MediaType.GitHubJson,
    [HttpHeader.ContentType]: MediaType.Json,
    [HttpHeader.GitHubApiVersion]: GITHUB_API_VERSION,
    [HttpHeader.UserAgent]: 'Mechane',
  });
}

function githubAuthorization({ token }: Pick<GitHubAuthorization, 'token'>): string {
  const credential = Redacted.value(token);

  return `Bearer ${credential}`;
}
