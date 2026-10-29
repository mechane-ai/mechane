import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspaceMemberList, WorkspacePath } from './schemas.ts';

/** Live owner authority is required to enumerate the workspace’s audience. */
export const listWorkspaceMembers = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/members',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: NoFields,
  output: WorkspaceMemberList,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
