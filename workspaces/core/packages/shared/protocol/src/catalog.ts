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
import { MECH_OPERATIONS } from './operations/mechs/mech-operations.ts';
import { sendNotification } from './operations/notifications/send-notification.ts';
import { manageSandbox } from './operations/sandboxes/manage-sandbox.ts';
import { STATUS_OPERATIONS } from './operations/status/status-operations.ts';
import { TURN_OPERATIONS } from './operations/turns/turn-operations.ts';
import { WORKSPACE_OPERATIONS } from './operations/workspaces/workspace-operations.ts';

/** The operations a deployment serves, keyed by name. */
type Catalog = Readonly<Record<string, Operation>>;

/** Every operation the server serves, keyed by name; the router and the client both derive from it. */
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
  sendNotification,
  ...MECH_OPERATIONS,
  manageSandbox,
  ...STATUS_OPERATIONS,
  ...TURN_OPERATIONS,
  ...WORKSPACE_OPERATIONS,
} as const satisfies Catalog;

/** The name of one operation of the catalog, such as `createMech`. */
export type OperationName = keyof typeof catalog;
