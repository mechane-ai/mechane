import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { SourceGrantState } from './schemas.ts';

/** Only a current workspace owner may inspect a mech's repository authority. */
export const showSourceGrant = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/source/grant',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: SourceGrantState,
  errors: [MechNotFound, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
