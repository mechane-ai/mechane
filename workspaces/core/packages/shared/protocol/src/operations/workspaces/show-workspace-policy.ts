import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound } from '../../errors/errors.ts';
import { InstallationAdministratorRequired } from '../../errors/workspace.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePolicy } from './policy.schemas.ts';
import { WorkspacePath } from './schemas.ts';

/** Installation administrators inspect effective policy even when the workspace is suspended. */
export const showWorkspacePolicy = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/policy',
  access: Access.Principal,
  params: WorkspacePath,
  query: NoFields,
  body: NoFields,
  output: WorkspacePolicy,
  errors: [ObjectUnavailable, InstallationAdministratorRequired, WorkspaceNotFound],
} as const satisfies Operation;
