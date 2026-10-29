import type { SlackInstallation } from '@mechane/deployment';
import { findSlackInstallation, resolveIntegrationSecret } from '@mechane/integrations';
import { WorkspaceId } from '@mechane/records';
import type { SlackDestination } from '@mechane/records';
import { Option } from 'effect';
import type { PreparedSlackDelivery, RunSlackDeliveryInput } from './types.ts';

type ResolveSlackClientInput = Pick<RunSlackDeliveryInput, 'settings' | 'mech'> & {
  readonly destination: SlackDestination;
};

type ResolveSlackTokensInput = ResolveSlackClientInput & { readonly installation: SlackInstallation };

/** Resolves scoped server credential references for a matching installation and audience. */
export function resolveSlackClient({
  settings,
  mech,
  destination,
}: ResolveSlackClientInput): Option.Option<PreparedSlackDelivery> {
  const workspaceId = WorkspaceId.make(mech.workspaceId);

  const installation = findSlackInstallation({
    installations: settings.slackInstallations,
    workspaceId,
    connectionId: destination.connectionId,
  });

  if (Option.isNone(installation) || installation.value.teamId !== destination.teamId) {
    return Option.none();
  }

  return resolveSlackTokens({ settings, mech, destination, installation: installation.value });
}

function resolveSlackTokens({
  settings,
  mech,
  destination,
  installation,
}: ResolveSlackTokensInput): Option.Option<PreparedSlackDelivery> {
  const secrets = { secrets: settings.integrationSecrets, workspaceId: mech.workspaceId };
  const botToken = resolveIntegrationSecret({ ...secrets, secretReference: installation.botTokenSecretReference });

  const historyReference = Option.getOrElse(
    installation.historyTokenSecretReference,
    () => installation.botTokenSecretReference,
  );

  const historyToken = resolveIntegrationSecret({ ...secrets, secretReference: historyReference });

  if (Option.isNone(botToken) || Option.isNone(historyToken)) {
    return Option.none();
  }

  return Option.some({ installation, destination, botToken: botToken.value, historyToken: historyToken.value });
}
