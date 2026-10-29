import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspaceList } from './schemas.ts';

/** Lists the workspaces the caller is a member of, oldest first. */
export const listWorkspaces = {
  method: HttpMethod.Get,
  path: '/v1/workspaces',
  access: Access.Principal,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: WorkspaceList,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
