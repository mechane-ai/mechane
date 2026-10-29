import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { ConnectionDeletion, ConnectionPath } from './schemas.ts';

/** Owners remove a connection together with all of its mech grants. */
export const deleteConnection = {
  method: HttpMethod.Delete,
  path: '/v1/workspaces/:workspace_id/connections/:connection_id',
  access: Access.Member,
  params: ConnectionPath,
  query: NoFields,
  body: NoFields,
  output: ConnectionDeletion,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
