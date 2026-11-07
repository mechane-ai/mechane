import { HttpMethod } from '@mechane/records';
import { ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspaceList } from './schemas.ts';

/** Lists the personal workspace first, followed by shared memberships in creation order. */
export const listWorkspaces = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces',
  access: Access.Principal,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: WorkspaceList,
  errors: [ServiceUnavailable],
} as const satisfies Operation;
