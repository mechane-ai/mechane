import { Array, Option, Record } from 'effect';
import { GITHUB_TOKEN_PERMISSION } from './constants.ts';
import type { GitHubTokenPermission } from './constants.ts';
import type { GitHubToken } from './schemas.ts';

const GITHUB_METADATA_PERMISSION = 'metadata';

type IsGitHubTokenGrantedInput = {
  readonly credential: GitHubToken;
  readonly repositoryId: number;
  readonly permission: GitHubTokenPermission;
  readonly permissions: Readonly<Record<string, string>>;
};

/** Refuses extra repositories or permissions, allowing GitHub's mandatory read-only metadata scope. */
export function isGitHubTokenGranted({
  credential,
  repositoryId,
  permission,
  permissions,
}: IsGitHubTokenGrantedInput): boolean {
  const repository = Array.head(credential.repositories);

  if (credential.repositories.length !== 1 || Option.isNone(repository)) {
    return false;
  }

  if (repository.value.id !== repositoryId || credential.permissions['contents'] !== permission) {
    return false;
  }

  const entries = Record.toEntries(credential.permissions);

  const isAllowed: (entry: [string, string]) => boolean = ([name, level]) => {
    if (name === GITHUB_METADATA_PERMISSION && level === GITHUB_TOKEN_PERMISSION.Read) {
      return true;
    }

    return permissions[name] === level;
  };

  return entries.every(isAllowed);
}
