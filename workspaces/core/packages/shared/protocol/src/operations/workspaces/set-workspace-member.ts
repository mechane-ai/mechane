import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MembershipRole } from './constants.ts';
import { MEMBER_MUTATION_FAILURES } from './member-mutation-failures.ts';
import { WorkspaceMember, WorkspaceMemberPath } from './schemas.ts';

const WorkspaceMemberRole = Schema.Struct({ role: Schema.Enum(MembershipRole) });

/** Owners grant or change membership without creating new principals. */
export const setWorkspaceMember = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/members/:principal_id',
  access: Access.Member,
  params: WorkspaceMemberPath,
  query: NoFields,
  body: WorkspaceMemberRole,
  output: WorkspaceMember,
  errors: MEMBER_MUTATION_FAILURES,
} as const satisfies Operation;
