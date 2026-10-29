import { HttpMethod } from '@mechane/records';
import {
  ConnectionNotFound,
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { ConnectionConfiguration, ConnectionPath, RemoteConnection } from './schemas.ts';

/** Owners replace configuration and prune removed tool names from existing grants. */
export const updateConnection = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/connections/:connection_id',
  access: Access.Member,
  params: ConnectionPath,
  query: NoFields,
  body: ConnectionConfiguration,
  output: RemoteConnection,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired, ConnectionNotFound],
} as const satisfies Operation;
