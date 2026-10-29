import type { Operation } from './operation/types.ts';
import { AUTH_OPERATIONS } from './operations/auth/auth-operations.ts';
import { CONNECTION_OPERATIONS } from './operations/connections/connection-operations.ts';
import { DRONE_OPERATIONS } from './operations/drones/drone-operations.ts';
import { listEvents } from './operations/events/list-events.ts';
import { listFindings } from './operations/findings/list-findings.ts';
import { sendInboxItem } from './operations/inbox/send-inbox-item.ts';
import { MECH_OPERATIONS } from './operations/mechs/mech-operations.ts';
import { listMemories } from './operations/memories/list-memories.ts';
import { manageSandbox } from './operations/sandboxes/manage-sandbox.ts';
import { SLACK_OPERATIONS } from './operations/slack/slack-operations.ts';
import { manageSource } from './operations/sources/manage-source.ts';
import { showSourceGrant } from './operations/sources/show-source-grant.ts';
import { STATUS_OPERATIONS } from './operations/status/status-operations.ts';
import { listThreads } from './operations/threads/list-threads.ts';
import { TURN_OPERATIONS } from './operations/turns/turn-operations.ts';
import { WATCH_OPERATIONS } from './operations/watches/watch-operations.ts';
import { WORKSPACE_OPERATIONS } from './operations/workspaces/workspace-operations.ts';

/** The operations a deployment serves, keyed by name. */
type Catalog = Readonly<Record<string, Operation>>;

/** Every operation the Worker serves, keyed by name; the router and the client both derive from it. */
export const catalog = {
  ...AUTH_OPERATIONS,
  ...CONNECTION_OPERATIONS,
  ...DRONE_OPERATIONS,
  listEvents,
  listFindings,
  sendInboxItem,
  ...MECH_OPERATIONS,
  listMemories,
  manageSandbox,
  ...SLACK_OPERATIONS,
  manageSource,
  showSourceGrant,
  ...STATUS_OPERATIONS,
  listThreads,
  ...TURN_OPERATIONS,
  ...WATCH_OPERATIONS,
  ...WORKSPACE_OPERATIONS,
} as const satisfies Catalog;

/** The name of one operation of the catalog, such as `createMech`. */
export type OperationName = keyof typeof catalog;
