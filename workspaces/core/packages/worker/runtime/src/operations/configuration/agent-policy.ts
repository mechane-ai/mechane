import { catalog } from '@mechane/protocol';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

type Policy = { readonly agentId: string; readonly creatorPrincipalId: string; readonly dailyCapMicros: number };

function policyWire(policy: Policy) {
  return {
    agent_id: policy.agentId,
    creator_principal_id: policy.creatorPrincipalId,
    daily_cap_micros: policy.dailyCapMicros,
  };
}

export function createAgentPolicyOperations({ store }: ConfigurationOperationsInput) {
  return {
    showManagedAgentPolicy: validatedOperation({
      operation: catalog.showManagedAgentPolicy,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);
        const policy = await store.managed.agents.policy.show({ ...input, principalId: actor.principalId });

        return policyWire(policy);
      },
    }),
    configureManagedAgentPolicy: validatedOperation({
      operation: catalog.configureManagedAgentPolicy,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const policy = await store.managed.agents.policy.setDailyCap({
          ...input,
          principalId: actor.principalId,
          credentialId: actor.keyId,
        });

        return policyWire(policy);
      },
    }),
  };
}
