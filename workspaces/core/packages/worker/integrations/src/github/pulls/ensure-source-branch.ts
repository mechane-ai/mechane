import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { githubReferencePath } from '../paths/github-reference-path.ts';
import { sourceBranchName } from '../paths/source-branch-name.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { GitHubObject } from '../schemas.ts';
import type { GitHubPullInput } from './types.ts';

const GitHubReference = Schema.Struct({ object: GitHubObject });
type GitHubReference = typeof GitHubReference.Type;

/** Reuses only a branch already at the intended commit and never moves a conflicting reference. */
export async function ensureSourceBranch({ ...input }: GitHubPullInput): Promise<Result.Result<void, GitHubFailed>> {
  const { origin, token, grant, sourceId, commit } = input;
  const branch = sourceBranchName({ sourceId, isQualified: false });
  const selectedBranch = Option.some(branch);
  const path = githubReferencePath({ grant, branch: selectedBranch });
  const body = Option.none();
  const current = await requestGitHub({ origin, token, path, method: HttpMethod.Get, body, schema: GitHubReference });

  if (Result.isSuccess(current)) {
    if (current.success.object.sha !== commit) {
      return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'source branch already points to another commit' });
    }

    return Result.succeed(undefined);
  }

  if (current.failure.status !== HttpStatusCode.NotFound) {
    return Result.fail(current.failure);
  }

  return await createSourceBranch(input);
}

async function createSourceBranch({
  origin,
  token,
  grant,
  sourceId,
  commit,
}: GitHubPullInput): Promise<Result.Result<void, GitHubFailed>> {
  const branch = Option.none();
  const path = githubReferencePath({ grant, branch });
  const reference = sourceBranchName({ sourceId, isQualified: true });
  const body = Option.some({ ref: reference, sha: commit });
  const created = await requestGitHub({ origin, token, path, method: HttpMethod.Post, body, schema: GitHubReference });

  return Result.map(created, () => undefined);
}
