import { HttpMethod } from '@mechane/records';
import { ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { ConnectionList } from './schemas.ts';

/** Owners inspect stored configuration without contacting remote remote URLs. */
export const listConnections = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/connections',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: NoFields,
  output: ConnectionList,
  errors: [ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
