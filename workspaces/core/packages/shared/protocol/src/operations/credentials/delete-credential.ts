import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { CredentialDeletion, CredentialPath } from './schemas.ts';

/** Owners remove a credential without deleting integrations that retain its reference. */
export const deleteCredential = {
  method: HttpMethod.Delete,
  path: '/v1/workspaces/:workspace_id/credentials/:secret_reference',
  access: Access.Member,
  params: CredentialPath,
  query: NoFields,
  body: NoFields,
  output: CredentialDeletion,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
