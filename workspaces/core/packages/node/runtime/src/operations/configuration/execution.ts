import { catalog } from '@mechane/protocol';
import type { ExecutionAccess as ProtocolExecutionAccess } from '@mechane/protocol';
import { Option } from 'effect';
import type { ExecutionAccess } from '../../domain.ts';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { executionAccessWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

export function createExecutionOperations({ store }: ConfigurationOperationsInput) {
  return {
    showExecutionAccess: validatedOperation({
      operation: catalog.showExecutionAccess,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: true,
        });

        const access = await store.getExecutionAccess(input);

        return executionAccessWire(access);
      },
    }),
    configureExecutionAccess: validatedOperation({
      operation: catalog.configureExecutionAccess,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const access = await store.configureExecutionAccess({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          principalId: actor.principalId,
          credentialId: actor.keyId,
          access: executionConfiguration(Option.getOrNull(input.access)),
        });

        return executionAccessWire(access);
      },
    }),
  };
}

function executionConfiguration(input: ProtocolExecutionAccess | null): ExecutionAccess | null {
  if (input === null) {
    return null;
  }

  const requestService = Option.map(input.requestService, (service) => ({
    url: service.url.href,
    serviceId: service.serviceId,
    secretReference: service.secretReference,
  }));

  return {
    github: Option.getOrNull(input.github),
    variables: input.variables,
    secrets: input.secrets,
    requestService: Option.getOrNull(requestService),
  };
}
