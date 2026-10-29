import { HttpMethod } from '@mechane/records';
import { Option } from 'effect';
import type { Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubPullsPath } from '../paths/github-pulls-path.ts';
import { sourceBranchName } from '../paths/source-branch-name.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { GitHubPull } from './schemas.ts';
import { sourcePullBody } from './source-pull-body.ts';
import type { GitHubPullInput } from './types.ts';

/** Writes a draft for one source-owned head without granting maintainers branch modification. */
export async function submitSourcePull({
  ...input
}: GitHubPullInput): Promise<Result.Result<GitHubPull, GitHubFailed>> {
  const { origin, token, grant, sourceId, title } = input;
  const body = sourcePullBody(input);
  const branch = sourceBranchName({ sourceId, isQualified: false });
  const noBranch = Option.none();
  const path = githubPullsPath({ grant, branch: noBranch });

  const payload = Option.some({
    title,
    body,
    head: branch,
    base: grant.baseBranch,
    draft: true,
    maintainer_can_modify: false,
  });

  return await requestGitHub({ origin, token, path, method: HttpMethod.Post, body: payload, schema: GitHubPull });
}
