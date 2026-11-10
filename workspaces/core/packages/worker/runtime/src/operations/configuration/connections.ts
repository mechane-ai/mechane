import type { ConnectionConfiguration } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import type { ConnectionConfiguration as ProtocolConnectionConfiguration } from '@mechane/protocol';
import { Option } from 'effect';
import { randomUUID } from 'node:crypto';
import type { AuthCaller } from '../types.ts';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { connectionWire, grantWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

type ConnectionMutation = {
  readonly input: ProtocolConnectionConfiguration & { readonly workspaceId: string };
  readonly caller: AuthCaller;
  readonly connectionId: string;
  readonly isCreation: boolean;
};

export function createConnectionOperations({ store }: ConfigurationOperationsInput) {
  async function saveConnection({ input, caller, connectionId, isCreation }: ConnectionMutation) {
    const actor = requireAuthenticated(caller);

    const connection = await store.saveConnection({
      workspaceId: input.workspaceId,
      principalId: actor.principalId,
      credentialId: actor.keyId,
      connectionId,
      configuration: connectionConfiguration(input),
      isCreation,
    });

    return connectionWire(connection);
  }

  return {
    listConnections: validatedOperation({
      operation: catalog.listConnections,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);
        const connections = await store.listConnections({ ...input, principalId: actor.principalId });

        return { connections: connections.map(connectionWire) };
      },
    }),
    createConnection: validatedOperation({
      operation: catalog.createConnection,
      run: async (context) => await saveConnection({ ...context, connectionId: randomUUID(), isCreation: true }),
    }),
    updateConnection: validatedOperation({
      operation: catalog.updateConnection,
      run: async (context) =>
        await saveConnection({ ...context, connectionId: context.input.connectionId, isCreation: false }),
    }),
    deleteConnection: validatedOperation({
      operation: catalog.deleteConnection,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.deleteConnection({ ...input, principalId: actor.principalId, credentialId: actor.keyId });

        return { connection_id: input.connectionId };
      },
    }),
    listToolGrants: validatedOperation({
      operation: catalog.listToolGrants,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);
        const grants = await store.listToolGrants({ ...input, principalId: actor.principalId });

        return { grants: grants.map(grantWire) };
      },
    }),
    grantTools: validatedOperation({
      operation: catalog.grantTools,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const grant = await store.saveToolGrant({
          ...input,
          principalId: actor.principalId,
          credentialId: actor.keyId,
        });

        return grantWire(grant);
      },
    }),
    revokeTools: validatedOperation({
      operation: catalog.revokeTools,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const grant = await store.saveToolGrant({
          ...input,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          tools: null,
        });

        return grantWire(grant);
      },
    }),
  };
}

function connectionConfiguration(input: ProtocolConnectionConfiguration): ConnectionConfiguration {
  return {
    name: input.name,
    url: input.url.href,
    secretReference: Option.getOrNull(input.secretReference),
    allowedTools: input.allowedTools,
    policy: input.policy,
  };
}
