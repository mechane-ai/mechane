import { Array, Option, Result } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { githubPullUrl } from '../paths/github-pull-url.ts';
import { sourceBranchName } from '../paths/source-branch-name.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { isSourcePullExpected } from './is-source-pull-expected.ts';
import type { GitHubPull } from './schemas.ts';
import { sourcePullBody } from './source-pull-body.ts';
import type { GitHubPullInput } from './types.ts';

type ConfirmSourcePullInput = {
  readonly source: GitHubPullInput;
  readonly pulls: ReadonlyArray<GitHubPull>;
  readonly reason: string;
};

/** Confirms exactly one matching draft before deriving its URL from the configured web origin. */
export function confirmSourcePull({
  source,
  pulls,
  reason,
}: ConfirmSourcePullInput): Result.Result<string, GitHubFailed> {
  const pull = Array.head(pulls);

  if (pulls.length !== 1 || Option.isNone(pull)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason });
  }

  const { grant, sourceId, commit, webOrigin } = source;
  const body = sourcePullBody(source);
  const branch = sourceBranchName({ sourceId, isQualified: false });
  const isExpected = isSourcePullExpected({ pull: pull.value, commit, branch, baseBranch: grant.baseBranch, body });

  if (!isExpected) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason });
  }

  const url = githubPullUrl({ grant, number: pull.value.number, webOrigin });

  return Result.succeed(url);
}
