import type { HttpMethod } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Result, Schema } from 'effect';
import type { Option } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import type { GitHubAuthorization } from '../types.ts';
import { failGitHub } from './fail-github.ts';
import { githubRequest } from './github-request.ts';

type GitHubRequestInput<Output, Encoded> = GitHubAuthorization & {
  readonly path: string;
  readonly method: HttpMethod;
  /** None denotes a request with no JSON body. */
  readonly body: Option.Option<unknown>;
  readonly schema: Schema.Codec<Output, Encoded>;
};

type ReadGitHubResponseInput<Output, Encoded> = {
  readonly response: Response;
  readonly schema: Schema.Codec<Output, Encoded>;
};

/** Issues one request and decodes its provider boundary without retrying side effects. */
export async function requestGitHub<Output, Encoded>({
  origin,
  token,
  path,
  method,
  body,
  schema,
}: GitHubRequestInput<Output, Encoded>): Promise<Result.Result<Output, GitHubFailed>> {
  const request = githubRequest({ origin, token, path, method, body });
  const pending = fetch(request);
  const response = await capturePromise({ promise: pending });

  if (Result.isFailure(response)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'GitHub request outcome is unknown' });
  }

  if (!response.success.ok) {
    return failGitHub({ status: response.success.status, reason: 'GitHub refused the request' });
  }

  return await readGitHubResponse({ response: response.success, schema });
}

async function readGitHubResponse<Output, Encoded>({
  response,
  schema,
}: ReadGitHubResponseInput<Output, Encoded>): Promise<Result.Result<Output, GitHubFailed>> {
  const pending = response.json();
  const payload = await capturePromise({ promise: pending });

  if (Result.isFailure(payload)) {
    return failGitHub({ status: response.status, reason: 'GitHub returned an invalid response' });
  }

  const decoded = Schema.decodeUnknownResult(schema)(payload.success);

  if (Result.isFailure(decoded)) {
    return failGitHub({ status: response.status, reason: 'GitHub returned an invalid response' });
  }

  return Result.succeed(decoded.success);
}
