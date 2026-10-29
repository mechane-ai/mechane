import { GitCommit, HttpMethod } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubCommitPath } from '../paths/github-commit-path.ts';
import { checkGitHubRepository } from '../repositories/check-github-repository.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { createSourceCommit } from './create-source-commit.ts';
import { createSourceTree } from './create-source-tree.ts';
import type { GitHubSourceInput } from './types.ts';

const GitHubCommit = Schema.Struct({ sha: GitCommit, tree: Schema.Struct({ sha: GitCommit }) });
type GitHubCommit = typeof GitHubCommit.Type;

/** Rechecks the grant and immutable base before publishing a derived source commit. */
export async function commitGitHubSource({
  ...input
}: GitHubSourceInput): Promise<Result.Result<string, GitHubFailed>> {
  const { origin, token, grant, baseCommit, changes } = input;
  const repository = await checkGitHubRepository({ origin, token, grant });

  if (Result.isFailure(repository)) {
    return Result.fail(repository.failure);
  }

  const base = await readSourceBase(input);

  if (Result.isFailure(base)) {
    return Result.fail(base.failure);
  }

  const tree = await createSourceTree({ origin, token, grant, changes, baseTree: base.success.tree.sha });

  if (Result.isFailure(tree)) {
    return tree;
  }

  return await createSourceCommit({ ...input, baseCommit, tree: tree.success });
}

async function readSourceBase({
  origin,
  token,
  grant,
  baseCommit,
}: GitHubSourceInput): Promise<Result.Result<GitHubCommit, GitHubFailed>> {
  const revision = Option.some(baseCommit);
  const path = githubCommitPath({ grant, commit: revision });
  const body = Option.none();

  return await requestGitHub({ origin, token, path, method: HttpMethod.Get, body, schema: GitHubCommit });
}
