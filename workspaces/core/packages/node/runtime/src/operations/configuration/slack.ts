import { catalog } from '@mechane/protocol';
import { Option } from 'effect';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { bindingWire, deliveryWire, installationWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

export function createSlackConfigurationOperations({ store }: ConfigurationOperationsInput) {
  return {
    listSlackInstallations: validatedOperation({
      operation: catalog.listSlackInstallations,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: true,
        });

        const installations = await store.listSlackInstallations(input);

        return { installations: installations.map(installationWire) };
      },
    }),
    configureSlackInstallation: validatedOperation({
      operation: catalog.configureSlackInstallation,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const result = await store.configureSlackInstallation({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          isCreateOnly: input.isCreateOnly,
          installation: {
            id: input.connectionId,
            workspaceId: input.workspaceId,
            teamId: input.teamId,
            botUserId: input.botUserId,
            signingSecretReference: input.signingSecretReference,
            botTokenReference: input.botTokenSecretReference,
            historyTokenReference: Option.getOrNull(input.historyTokenSecretReference),
            apiOrigin: input.apiOrigin.href,
          },
        });

        if (result._tag === 'Conflicting') {
          return result;
        }

        return { _tag: 'Configured', installation: installationWire(result.installation) };
      },
    }),
    deleteSlackInstallation: validatedOperation({
      operation: catalog.deleteSlackInstallation,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.deleteSlackInstallation({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          installationId: input.connectionId,
        });

        return { connection_id: input.connectionId };
      },
    }),
    listSlackBindings: validatedOperation({
      operation: catalog.listSlackBindings,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: false,
        });

        const bindings = await store.listSlackBindings(input);

        return { bindings: bindings.map(bindingWire) };
      },
    }),
    configureSlackBinding: validatedOperation({
      operation: catalog.configureSlackBinding,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const result = await store.configureSlackBinding({
          workspaceId: input.workspaceId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          binding: {
            id: input.id,
            installationId: input.connectionId,
            teamId: input.teamId,
            channelId: input.channelId,
            channelKind: input.channelKind,
            mechId: input.mechId,
            isListening: input.isListening,
            isReplyEnabled: input.isReplyEnabled,
            allowedUserIds: input.allowedUserIds ?? null,
          },
        });

        if (result._tag !== 'Configured') {
          return result;
        }

        return { _tag: 'Configured', binding: bindingWire(result.binding) };
      },
    }),
    listSlackDeliveries: validatedOperation({
      operation: catalog.listSlackDeliveries,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: false,
        });

        const [deliveries, bindings] = await Promise.all([
          store.listSlackDeliveries(input),
          store.listSlackBindings(input),
        ]);

        const bindingIndex = new Map(bindings.map((binding) => [binding.id, binding]));

        const receipts = deliveries.map((delivery) => {
          const binding = bindingIndex.get(delivery.bindingId);

          if (binding === undefined) {
            throw new Error('Slack receipt has no bound audience');
          }

          return deliveryWire(delivery, binding);
        });

        return { deliveries: receipts };
      },
    }),
  };
}
