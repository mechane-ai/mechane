import { HttpMethod } from '@mechane/records';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MEMBER_MUTATION_FAILURES } from './member-mutation-failures.ts';
import { WorkspaceMemberPath, WorkspaceMemberRemoval } from './schemas.ts';

/** Revocation takes effect on the next workspace request even with a cached key. */
export const removeWorkspaceMember = {
  method: HttpMethod.Delete,
  path: '/v1/workspaces/:workspace_id/members/:principal_id',
  access: Access.Member,
  params: WorkspaceMemberPath,
  query: NoFields,
  body: NoFields,
  output: WorkspaceMemberRemoval,
  errors: MEMBER_MUTATION_FAILURES,
} as const satisfies Operation;
