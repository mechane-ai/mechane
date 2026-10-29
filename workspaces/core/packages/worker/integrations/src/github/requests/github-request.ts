import type { HttpMethod } from '@mechane/records';
import { Duration, Option } from 'effect';
import type { GitHubAuthorization } from '../types.ts';
import { githubHeaders } from './github-headers.ts';

/** Bounds each provider request without retrying an uncertain mutation. */
const GITHUB_REQUEST_TIMEOUT = Duration.seconds(20);

type GitHubRequestInput = GitHubAuthorization & {
  readonly path: string;
  readonly method: HttpMethod;
  /** None denotes a request with no JSON body. */
  readonly body: Option.Option<unknown>;
};

/** Redirects remain observable refusals, so credentials never follow another origin. */
export function githubRequest({ origin, token, path, method, body }: GitHubRequestInput): Request {
  const url = new URL(path, origin);
  const encoded = Option.map(body, JSON.stringify);
  const requestBody = Option.getOrNull(encoded);
  const timeoutMillis = Duration.toMillis(GITHUB_REQUEST_TIMEOUT);
  const headers = githubHeaders({ token });
  const signal = AbortSignal.timeout(timeoutMillis);

  return new Request(url, { method, body: requestBody, redirect: 'manual', signal, headers });
}
