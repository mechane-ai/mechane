import { createAgentPolicyOperations } from './agent-policy.ts';
import { createConnectionOperations } from './connections.ts';
import { createCredentialOperations } from './credentials.ts';
import { createExecutionOperations } from './execution.ts';
import type { ConfigurationOperationsInput } from './types.ts';
import { createWorkspaceOperations } from './workspaces.ts';

export function createConfigurationOperations(input: ConfigurationOperationsInput) {
  return {
    ...createAgentPolicyOperations(input),
    ...createWorkspaceOperations(input),
    ...createCredentialOperations(input),
    ...createConnectionOperations(input),
    ...createExecutionOperations(input),
  };
}
