import { HttpMethod } from '@mechane/records';
import { Option, Result } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { githubTreePath } from '../paths/github-tree-path.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { requestGitHub } from '../requests/request-github.ts';
import type { GitHubRepositoryInput } from '../types.ts';
import { GitHubTree } from './schemas.ts';

type ReadSourceTreeInput = GitHubRepositoryInput & { readonly baseTree: string };

/** An incomplete recursive tree cannot establish that a patch leaves protected objects intact. */
export async function readSourceTree({
  origin,
  token,
  grant,
  baseTree,
}: ReadSourceTreeInput): Promise<Result.Result<GitHubTree, GitHubFailed>> {
  const tree = Option.some(baseTree);
  const path = githubTreePath({ grant, tree });
  const body = Option.none();
  const original = await requestGitHub({ origin, token, path, method: HttpMethod.Get, body, schema: GitHubTree });

  if (Result.isFailure(original)) {
    return original;
  }

  if (original.success.isTruncated) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub base tree is truncated; narrow this repository workflow before publication',
    });
  }

  return original;
}
