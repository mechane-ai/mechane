import type { IntegrationSecrets, SecureOrigin } from '@mechane/deployment';
import type { SourceGrant } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Option, Result } from 'effect';
import { resolveIntegrationSecret } from '../../resolve-integration-secret.ts';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';
import type { GitHubTokenPermission } from './constants.ts';
import { mintGitHubToken } from './mint-github-token.ts';
import type { GitHubToken } from './schemas.ts';
import { signGitHubAssertion } from './sign-github-assertion.ts';

type CreateGitHubTokenInput = {
  readonly origin: SecureOrigin;
  /** None means the operator configured no integration credentials. */
  readonly secrets: Option.Option<IntegrationSecrets>;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly grant: SourceGrant;
  readonly permission: GitHubTokenPermission;
};

/** Mints one repository-scoped credential and revokes any response outside the approved grant. */
export async function createGitHubToken({
  origin,
  secrets,
  workspaceId,
  grant,
  permission,
}: CreateGitHubTokenInput): Promise<Result.Result<GitHubToken, GitHubFailed>> {
  const secret = resolveIntegrationSecret({ secrets, workspaceId, secretReference: grant.secretReference });

  if (Option.isNone(secret)) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub App private key is not configured for this workspace',
    });
  }

  const assertion = await signGitHubAssertion({ secret: secret.value, appId: grant.appId });

  if (Result.isFailure(assertion)) {
    return Result.fail(assertion.failure);
  }

  return await mintGitHubToken({ origin, token: assertion.success, grant, permission });
}
