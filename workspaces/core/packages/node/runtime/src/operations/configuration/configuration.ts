import { createConnectionOperations } from './connections.ts';
import { createCredentialOperations } from './credentials.ts';
import { createExecutionOperations } from './execution.ts';
import { createSlackConfigurationOperations } from './slack.ts';
import type { ConfigurationOperationsInput } from './types.ts';
import { createWorkspaceOperations } from './workspaces.ts';

export function createConfigurationOperations(input: ConfigurationOperationsInput) {
  return {
    ...createWorkspaceOperations(input),
    ...createCredentialOperations(input),
    ...createConnectionOperations(input),
    ...createExecutionOperations(input),
    ...createSlackConfigurationOperations(input),
  };
}
