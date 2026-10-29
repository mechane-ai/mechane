import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { ToolGrant, ToolGrantPath } from './schemas.ts';

/** Owners remove a grant before subsequent tool dispatches. */
export const revokeTools = {
  method: HttpMethod.Delete,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/grants/:connection_id',
  access: Access.Member,
  params: ToolGrantPath,
  query: NoFields,
  body: NoFields,
  output: ToolGrant,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
