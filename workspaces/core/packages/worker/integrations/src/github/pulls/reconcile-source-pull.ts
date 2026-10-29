import { HttpMethod } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubPullsPath } from '../paths/github-pulls-path.ts';
import { sourceBranchName } from '../paths/source-branch-name.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { confirmSourcePull } from './confirm-source-pull.ts';
import { GitHubPull } from './schemas.ts';
import type { GitHubPullInput } from './types.ts';

const GitHubPulls = Schema.Array(GitHubPull);
type GitHubPulls = typeof GitHubPulls.Type;

/** Reads every pull state before deciding whether an interrupted publication can be reused. */
export async function reconcileSourcePull({
  ...input
}: GitHubPullInput): Promise<Result.Result<Option.Option<string>, GitHubFailed>> {
  const { origin, token, grant, sourceId } = input;
  const branch = sourceBranchName({ sourceId, isQualified: false });
  const selectedBranch = Option.some(branch);
  const path = githubPullsPath({ grant, branch: selectedBranch });
  const body = Option.none();
  const pulls = await requestGitHub({ origin, token, path, method: HttpMethod.Get, body, schema: GitHubPulls });

  if (Result.isFailure(pulls)) {
    return Result.fail(pulls.failure);
  }

  return reconcileSourcePulls({ source: input, pulls: pulls.success });
}

type ReconcileSourcePullsInput = { readonly source: GitHubPullInput; readonly pulls: GitHubPulls };

function reconcileSourcePulls({
  source,
  pulls,
}: ReconcileSourcePullsInput): Result.Result<Option.Option<string>, GitHubFailed> {
  if (pulls.length === 0) {
    const absent = Option.none<string>();

    return Result.succeed(absent);
  }

  const confirmed = confirmSourcePull({ source, pulls, reason: 'source branch has a conflicting pull request' });

  return Result.map(confirmed, Option.some);
}
