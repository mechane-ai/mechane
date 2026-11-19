import type { Operation } from './operation/types.ts';
import { AUTH_OPERATIONS } from './operations/auth/auth-operations.ts';
import { CONNECTION_OPERATIONS } from './operations/connections/connection-operations.ts';
import { listConsoleMessages } from './operations/conversation/list-console-messages.ts';
import { CREDENTIAL_OPERATIONS } from './operations/credentials/credential-operations.ts';
import { ENVIRONMENT_OPERATIONS } from './operations/environment/environment-operations.ts';
import { listEvents } from './operations/events/list-events.ts';
import { listRecentEvents } from './operations/events/list-recent-events.ts';
import { EVIDENCE_OPERATIONS } from './operations/evidence/evidence-operations.ts';
import { EXECUTION_ACCESS_OPERATIONS } from './operations/execution-access/execution-access-operations.ts';
import { listHeldWork } from './operations/history/list-held-work.ts';
import { listMechHistory } from './operations/history/list-mech-history.ts';
import { MECH_OPERATIONS } from './operations/mechs/mech-operations.ts';
import { ROUTINE_OPERATIONS } from './operations/routines/routine-operations.ts';
import { manageSandbox } from './operations/sandboxes/manage-sandbox.ts';
import { restoreSandbox } from './operations/sandboxes/restore-sandbox.ts';
import { SERVICE_PRINCIPAL_OPERATIONS } from './operations/service-principals/service-principal-operations.ts';
import { STATUS_OPERATIONS } from './operations/status/status-operations.ts';
import { TURN_OPERATIONS } from './operations/turns/turn-operations.ts';
import { WORKSPACE_OPERATIONS } from './operations/workspaces/workspace-operations.ts';

type Catalog = Readonly<Record<string, Operation>>;

/** First-party authentication, workspace administration and native operator routes. */
export const catalog = {
  ...AUTH_OPERATIONS,
  ...CONNECTION_OPERATIONS,
  ...CREDENTIAL_OPERATIONS,
  ...EVIDENCE_OPERATIONS,
  ...ENVIRONMENT_OPERATIONS,
  ...EXECUTION_ACCESS_OPERATIONS,
  listEvents,
  listRecentEvents,
  listConsoleMessages,
  ...ROUTINE_OPERATIONS,
  ...MECH_OPERATIONS,
  listHeldWork,
  listMechHistory,
  manageSandbox,
  restoreSandbox,
  ...SERVICE_PRINCIPAL_OPERATIONS,
  ...STATUS_OPERATIONS,
  ...TURN_OPERATIONS,
  ...WORKSPACE_OPERATIONS,
} as const satisfies Catalog;

/** Names the first-party operation selected by the router and typed client. */
export type OperationName = keyof typeof catalog;
