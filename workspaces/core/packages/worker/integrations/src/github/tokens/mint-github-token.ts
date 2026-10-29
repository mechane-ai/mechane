import type { SourceGrant } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Option, Result } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { requestGitHub } from '../requests/request-github.ts';
import type { GitHubRepositoryInput } from '../types.ts';
import type { GitHubTokenPermission } from './constants.ts';
import { githubTokenPermissions } from './github-token-permissions.ts';
import { isGitHubTokenGranted } from './is-github-token-granted.ts';
import { revokeGitHubToken } from './revoke-github-token.ts';
import { GitHubToken } from './schemas.ts';

type MintGitHubTokenInput = GitHubRepositoryInput & { readonly permission: GitHubTokenPermission };

/** Verifies the credential's effective grant before allowing any repository operation. */
export async function mintGitHubToken({
  origin,
  token,
  grant,
  permission,
}: MintGitHubTokenInput): Promise<Result.Result<GitHubToken, GitHubFailed>> {
  const permissions = githubTokenPermissions({ permission });
  const path = githubAccessTokensPath({ installationId: grant.installationId });
  const body = Option.some({ repository_ids: [grant.repositoryId], permissions });
  const minted = await requestGitHub({ origin, token, path, method: HttpMethod.Post, body, schema: GitHubToken });

  if (Result.isFailure(minted)) {
    return minted;
  }

  const credential = minted.success;
  const isGranted = isGitHubTokenGranted({ credential, repositoryId: grant.repositoryId, permission, permissions });

  if (!isGranted) {
    await revokeGitHubToken({ origin, token: credential.token });

    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub returned a credential outside the repository grant',
    });
  }

  return minted;
}

function githubAccessTokensPath({ installationId }: Pick<SourceGrant, 'installationId'>): string {
  return `/app/installations/${installationId}/access_tokens`;
}
