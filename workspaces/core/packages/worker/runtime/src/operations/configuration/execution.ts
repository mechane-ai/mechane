import type { ExecutionAccess, ManagedScope } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import type { ExecutionAccess as ProtocolExecutionAccess } from '@mechane/protocol';
import { Option } from 'effect';
import type { AuthenticatedCaller } from '../types.ts';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { executionAccessWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

function commandGrantScope(workspaceId: string, actor: AuthenticatedCaller): ManagedScope {
  const scope = { workspaceId, principalId: actor.principalId, isAdmin: false };

  if (actor.authKind === 'key') {
    return { ...scope, apiKeyId: actor.keyId };
  }

  return scope;
}

export function createExecutionOperations({ store }: ConfigurationOperationsInput) {
  return {
    showManagedCommandAccess: validatedOperation({
      operation: catalog.showManagedCommandAccess,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const access = await store.managed.installed.commandAccess.get({
          scope: commandGrantScope(input.workspaceId, actor),
          agentId: input.agentId,
          granteePrincipalId: input.granteePrincipalId,
        });

        return executionAccessWire(access);
      },
    }),
    configureManagedCommandAccess: validatedOperation({
      operation: catalog.configureManagedCommandAccess,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const configure = store.managed.installed.commandAccess.set;

        const access = await configure({
          scope: commandGrantScope(input.workspaceId, actor),
          agentId: input.agentId,
          granteePrincipalId: input.granteePrincipalId,
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

  return { variables: input.variables, secrets: input.secrets };
}
