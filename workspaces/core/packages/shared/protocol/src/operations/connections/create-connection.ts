import { HttpMethod } from '@mechane/records';
import {
  ConnectionLimitReached,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { ConnectionConfiguration, RemoteConnection } from './schemas.ts';

/** Owners declare a remote URL, tool policy, and allowlist before any mech can receive access. */
export const createConnection = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/connections',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: ConnectionConfiguration,
  output: RemoteConnection,
  errors: [ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired, ConnectionLimitReached],
} as const satisfies Operation;
