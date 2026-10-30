import { readWorkspacePolicy } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Option, Result } from 'effect';
import type { Redacted } from 'effect';
import { resolveIntegrationSecret } from '../../resolve-integration-secret.ts';
import type { ResolveIntegrationSecretInput } from '../../types.ts';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';

/** Suspension is checked at the provider boundary before a private key can mint new repository access. */
export async function readGitHubPrivateKey({
  settings,
  workspaceId,
  secretReference,
}: ResolveIntegrationSecretInput): Promise<Result.Result<Redacted.Redacted, GitHubFailed>> {
  const pending = readWorkspacePolicy({ bindings: settings, workspaceId });
  const policy = await capturePromise({ promise: pending });

  if (Result.isFailure(policy)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'Workspace policy is unavailable' });
  }

  if (policy.success.isSuspended) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub source access is suspended for this workspace',
    });
  }

  const resolved = await resolveIntegrationSecret({ settings, workspaceId, secretReference });

  if (Result.isFailure(resolved)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'GitHub App private key is unavailable' });
  }

  if (Option.isNone(resolved.success)) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'GitHub App private key is not configured for this workspace',
    });
  }

  return Result.succeed(resolved.success.value);
}
