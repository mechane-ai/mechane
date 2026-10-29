import { createConnection } from './create-connection.ts';
import { deleteConnection } from './delete-connection.ts';
import { grantTools } from './grant-tools.ts';
import { listConnections } from './list-connections.ts';
import { listToolGrants } from './list-tool-grants.ts';
import { revokeTools } from './revoke-tools.ts';
import { updateConnection } from './update-connection.ts';

/** Workspace integration connections and mech tool grants. */
export const CONNECTION_OPERATIONS = {
  createConnection,
  updateConnection,
  deleteConnection,
  listConnections,
  grantTools,
  revokeTools,
  listToolGrants,
} as const;
