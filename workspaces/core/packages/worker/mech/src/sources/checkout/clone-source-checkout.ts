import {
  checkGitHubRepository,
  createGitHubToken,
  GITHUB_TOKEN_PERMISSION,
  revokeGitHubToken,
} from '@mechane/integrations';
import type { SourceTask } from '@mechane/mech-store';
import { SourceClone } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import type { DateTime, Redacted } from 'effect';
import { finishSourceCheckout } from './finish-source-checkout.ts';
import type { SourceCheckoutContext } from './types.ts';

type SourceCheckoutCredential = SourceCheckoutContext & {
  readonly token: Redacted.Redacted;
  readonly expiresAt: DateTime.Utc;
};

/** The read token is minted only after a fresh, fenced guest acknowledges preparation. */
export async function cloneSourceCheckout({
  mech,
  owner,
  source,
  sandbox,
  checkout,
}: SourceCheckoutContext): Promise<SourceTask> {
  const context = { mech, owner, source, sandbox, checkout };

  const token = await createGitHubToken({
    origin: mech.settings.githubApiOrigin,
    settings: mech.settings,
    workspaceId: owner.workspaceId,
    grant: source.grant,
    permission: GITHUB_TOKEN_PERMISSION.Read,
  });

  if (Result.isFailure(token)) {
    await sandbox.revokeSource(checkout);

    const reason = Option.some(token.failure.reason);

    return await finishSourceCheckout({ ...context, reason });
  }

  return await cloneWithCredential({ ...context, token: token.success.token, expiresAt: token.success.expires_at });
}

async function cloneWithCredential({
  mech,
  owner,
  source,
  sandbox,
  checkout,
  token,
  expiresAt,
}: SourceCheckoutCredential): Promise<SourceTask> {
  const context = { mech, owner, source, sandbox, checkout };
  const authorization = { origin: mech.settings.githubApiOrigin, token };
  const repository = await checkGitHubRepository({ ...authorization, grant: source.grant });

  if (Result.isFailure(repository)) {
    await revokeGitHubToken(authorization);
    await sandbox.revokeSource(checkout);

    const reason = Option.some(repository.failure.reason);

    return await finishSourceCheckout({ ...context, reason });
  }

  const clone = Schema.encodeSync(SourceClone)({ ...checkout, token, expiresAt });
  const promise = sandbox.cloneSource({ clone });

  await capturePromise({ promise });

  const isRevoked = await revokeGitHubToken(authorization);

  if (isRevoked) {
    await sandbox.revokeSource(checkout);
  }

  const reason = Option.none<string>();

  return await finishSourceCheckout({ ...context, reason });
}
