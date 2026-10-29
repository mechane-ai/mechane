import { HttpMethod } from '@mechane/records';
import {
  ConnectionLimitReached,
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { ConnectionConfiguration, RemoteConnection } from './schemas.ts';

/** Owners declare an remote URL and approved free reads before any mech can receive access. */
export const createConnection = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/connections',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: ConnectionConfiguration,
  output: RemoteConnection,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired, ConnectionLimitReached],
} as const satisfies Operation;
