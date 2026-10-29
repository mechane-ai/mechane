import { HttpMethod } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { githubRepositoryPath } from '../paths/github-repository-path.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { requestGitHub } from '../requests/request-github.ts';
import type { GitHubRepositoryInput } from '../types.ts';

const GitHubRepository = Schema.Struct({ id: Schema.Int, full_name: Schema.String });
type GitHubRepository = typeof GitHubRepository.Type;

/** Checks stable repository identity so a rename or transfer cannot silently broaden a grant. */
export async function checkGitHubRepository({
  origin,
  token,
  grant,
}: GitHubRepositoryInput): Promise<Result.Result<void, GitHubFailed>> {
  const path = githubRepositoryPath({ grant, suffix: '' });
  const body = Option.none();

  const repository = await requestGitHub({
    origin,
    token,
    path,
    method: HttpMethod.Get,
    body,
    schema: GitHubRepository,
  });

  if (Result.isFailure(repository)) {
    return Result.fail(repository.failure);
  }

  const returnedName = repository.success.full_name.toLowerCase();
  const grantedPath = githubRepositoryName({ grant });
  const grantedName = grantedPath.toLowerCase();

  if (repository.success.id !== grant.repositoryId || returnedName !== grantedName) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub repository identity differs from the owner grant',
    });
  }

  return Result.succeed(undefined);
}

function githubRepositoryName({ grant }: Pick<GitHubRepositoryInput, 'grant'>): string {
  return `${grant.owner}/${grant.repository}`;
}
