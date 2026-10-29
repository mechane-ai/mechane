import { HttpMethod } from '@mechane/records';
import { DateTime, Option, Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubCommitPath } from '../paths/github-commit-path.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { GitHubObject } from '../schemas.ts';
import type { GitHubSourceInput } from './types.ts';

type CreateSourceCommitInput = GitHubSourceInput & { readonly tree: string };

/** Fixed provenance and author time make the resulting commit deterministic for one source record. */
export async function createSourceCommit({
  origin,
  token,
  grant,
  baseCommit,
  sourceId,
  title,
  createdAt,
  tree,
}: CreateSourceCommitInput): Promise<Result.Result<string, GitHubFailed>> {
  const date = DateTime.formatIso(createdAt);
  const identity = { name: 'Mechane', email: 'mechane@users.noreply.github.com', date };
  const revision = Option.none();
  const path = githubCommitPath({ grant, commit: revision });

  const body = Option.some({
    message: `${title}\n\nMechane source: ${sourceId}`,
    tree,
    parents: [baseCommit],
    author: identity,
    committer: identity,
  });

  const commit = await requestGitHub({ origin, token, path, method: HttpMethod.Post, body, schema: GitHubObject });

  return Result.map(commit, (value) => value.sha);
}
