import { findSlackInstallation, resolveIntegrationSecret } from '@mechane/integrations';
import type { IntegrationSecretInvalid } from '@mechane/integrations';
import type { ObjectUnavailable, SlackInstallation } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import type { SlackDestination } from '@mechane/records';
import { Option, Result } from 'effect';
import type { PreparedSlackDelivery, RunSlackDeliveryInput } from './types.ts';

type SlackClientResolution = Result.Result<
  Option.Option<PreparedSlackDelivery>,
  ObjectUnavailable | IntegrationSecretInvalid
>;

type ResolveSlackClientInput = Pick<RunSlackDeliveryInput, 'settings' | 'mech'> & {
  readonly destination: SlackDestination;
};

type ResolveSlackTokensInput = ResolveSlackClientInput & { readonly installation: SlackInstallation };

/** Resolves scoped server credential references for a matching installation and audience. */
export async function resolveSlackClient({
  settings,
  mech,
  destination,
}: ResolveSlackClientInput): Promise<SlackClientResolution> {
  const workspaceId = WorkspaceId.make(mech.workspaceId);

  const found = await findSlackInstallation({ settings, workspaceId, connectionId: destination.connectionId });

  if (Result.isFailure(found)) {
    return Result.fail(found.failure);
  }

  const installation = found.success;

  if (Option.isNone(installation) || installation.value.teamId !== destination.teamId) {
    const missing = Option.none();

    return Result.succeed(missing);
  }

  return await resolveSlackTokens({ settings, mech, destination, installation: installation.value });
}

async function resolveSlackTokens({
  settings,
  mech,
  destination,
  installation,
}: ResolveSlackTokensInput): Promise<SlackClientResolution> {
  const secrets = { settings, workspaceId: mech.workspaceId };

  const botAnswer = await resolveIntegrationSecret({
    ...secrets,
    secretReference: installation.botTokenSecretReference,
  });

  const historyReference = Option.getOrElse(
    installation.historyTokenSecretReference,
    () => installation.botTokenSecretReference,
  );

  const historyAnswer = await resolveIntegrationSecret({ ...secrets, secretReference: historyReference });

  if (Result.isFailure(botAnswer)) {
    return Result.fail(botAnswer.failure);
  }

  if (Result.isFailure(historyAnswer)) {
    return Result.fail(historyAnswer.failure);
  }

  const tokens = Option.all({ botToken: botAnswer.success, historyToken: historyAnswer.success });
  const prepared = Option.map(tokens, (credentials) => ({ installation, destination, ...credentials }));

  return Result.succeed(prepared);
}
