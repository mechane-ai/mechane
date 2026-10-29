import { GITHUB_TOKEN_PERMISSION } from './constants.ts';
import type { GitHubTokenPermission } from './constants.ts';

type GitHubTokenPermissionsInput = { readonly permission: GitHubTokenPermission };

/** Read credentials omit pull-request writes; publication adds only that capability. */
export function githubTokenPermissions({ permission }: GitHubTokenPermissionsInput): Readonly<Record<string, string>> {
  if (permission === GITHUB_TOKEN_PERMISSION.Write) {
    return { contents: permission, pull_requests: GITHUB_TOKEN_PERMISSION.Write };
  }

  return { contents: permission };
}
