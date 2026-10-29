import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Option, Result } from 'effect';
import { githubRequest } from '../requests/github-request.ts';
import type { GitHubAuthorization } from '../types.ts';

/** Revocation is confirmed only by GitHub's expected empty success response. */
export async function revokeGitHubToken({ origin, token }: GitHubAuthorization): Promise<boolean> {
  const path = githubTokenPath();
  const body = Option.none();
  const request = githubRequest({ origin, token, path, method: HttpMethod.Delete, body });
  const pending = fetch(request);
  const response = await capturePromise({ promise: pending });

  return Result.isSuccess(response) && response.success.status === HttpStatusCode.NoContent;
}

function githubTokenPath(): string {
  return '/installation/token';
}
