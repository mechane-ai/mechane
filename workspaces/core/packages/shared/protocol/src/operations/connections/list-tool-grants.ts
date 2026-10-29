import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { ToolGrantList } from './schemas.ts';

/** Owners inspect a mech's current connection selections. */
export const listToolGrants = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/grants',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: ToolGrantList,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
