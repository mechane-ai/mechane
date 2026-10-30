import type { SecureOrigin } from '@mechane/deployment';
import type { SourceGrant } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Result } from 'effect';
import type { IntegrationSettings } from '../../types.ts';
import type { GitHubFailed } from '../errors.ts';
import type { GitHubTokenPermission } from './constants.ts';
import { mintGitHubToken } from './mint-github-token.ts';
import { readGitHubPrivateKey } from './read-github-private-key.ts';
import type { GitHubToken } from './schemas.ts';
import { signGitHubAssertion } from './sign-github-assertion.ts';

type CreateGitHubTokenInput = {
  readonly origin: SecureOrigin;
  readonly settings: IntegrationSettings;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly grant: SourceGrant;
  readonly permission: GitHubTokenPermission;
};

/** Mints one repository-scoped credential and revokes any response outside the approved grant. */
export async function createGitHubToken({
  origin,
  settings,
  workspaceId,
  grant,
  permission,
}: CreateGitHubTokenInput): Promise<Result.Result<GitHubToken, GitHubFailed>> {
  const secret = await readGitHubPrivateKey({ settings, workspaceId, secretReference: grant.secretReference });

  if (Result.isFailure(secret)) {
    return Result.fail(secret.failure);
  }

  const assertion = await signGitHubAssertion({ secret: secret.success, appId: grant.appId });

  if (Result.isFailure(assertion)) {
    return Result.fail(assertion.failure);
  }

  return await mintGitHubToken({ origin, token: assertion.success, grant, permission });
}
