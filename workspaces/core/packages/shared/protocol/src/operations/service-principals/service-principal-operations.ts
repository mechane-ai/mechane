import { HttpMethod, ServiceKeyId, wireStruct, WorkspaceId } from '@mechane/records';
import {
  KeyNotFound,
  RequestInvalid,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { PersonalWorkspaceProtected } from '../../errors/workspace.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import {
  IssuedWorkspaceServiceKey,
  RevokedWorkspaceServiceKey,
  ServiceSubject,
  WorkspaceServicePrincipal,
} from './schemas.ts';

const identity = { workspaceId: WorkspaceId, subject: ServiceSubject } as const;

const ownerOperation = {
  access: Access.Owner,
  params: wireStruct({ fields: identity }),
  query: NoFields,
  body: NoFields,
  errors: [RequestInvalid, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired, PersonalWorkspaceProtected],
} as const;

/** Workspace owners provision service identities and rotate or revoke their native Managed Agents credentials. */
export const SERVICE_PRINCIPAL_OPERATIONS = {
  showWorkspaceServicePrincipal: {
    ...ownerOperation,
    method: HttpMethod.Get,
    path: '/api/operator/workspaces/:workspace_id/service-principals/:subject',
    output: WorkspaceServicePrincipal,
  },
  rotateWorkspaceServiceKey: {
    ...ownerOperation,
    method: HttpMethod.Post,
    path: '/api/operator/workspaces/:workspace_id/service-principals/:subject/key',
    output: IssuedWorkspaceServiceKey,
  },
  revokeWorkspaceServiceKey: {
    ...ownerOperation,
    method: HttpMethod.Delete,
    path: '/api/operator/workspaces/:workspace_id/service-principals/:subject/keys/:key_id',
    params: wireStruct({ fields: { ...identity, keyId: ServiceKeyId } }),
    output: RevokedWorkspaceServiceKey,
    errors: [...ownerOperation.errors, KeyNotFound],
  },
} as const satisfies Readonly<Record<string, Operation>>;
