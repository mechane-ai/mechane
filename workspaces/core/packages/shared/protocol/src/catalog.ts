import type { Operation } from './operation/types.ts';
import { AGENT_POLICY_OPERATIONS } from './operations/agents/agent-policy.ts';
import { AUTH_OPERATIONS } from './operations/auth/auth-operations.ts';
import { CREDENTIAL_OPERATIONS } from './operations/credentials/credential-operations.ts';
import { EXECUTION_ACCESS_OPERATIONS } from './operations/execution-access/execution-access-operations.ts';
import { SERVICE_PRINCIPAL_OPERATIONS } from './operations/service-principals/service-principal-operations.ts';
import { STATUS_OPERATIONS } from './operations/status/status-operations.ts';
import { WORKSPACE_OPERATIONS } from './operations/workspaces/workspace-operations.ts';

type Catalog = Readonly<Record<string, Operation>>;

/** First-party authentication, workspace administration, and Managed Agents operator routes. */
export const catalog = {
  ...AGENT_POLICY_OPERATIONS,
  ...AUTH_OPERATIONS,
  ...CREDENTIAL_OPERATIONS,
  ...EXECUTION_ACCESS_OPERATIONS,
  ...SERVICE_PRINCIPAL_OPERATIONS,
  ...STATUS_OPERATIONS,
  ...WORKSPACE_OPERATIONS,
} as const satisfies Catalog;

/** Names the first-party operation selected by the router and typed client. */
export type OperationName = keyof typeof catalog;
