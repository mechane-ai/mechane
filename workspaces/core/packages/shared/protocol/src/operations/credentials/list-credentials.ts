import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { CredentialList } from './schemas.ts';

/** Owners inspect workspace credential metadata without decrypting stored values. */
export const listCredentials = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/credentials',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: NoFields,
  output: CredentialList,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
