import { HttpMethod, RecordName, wireStruct, WorkspaceId } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { InstallationAdministratorRequired, WorkspaceCreationConflict } from '../../errors/workspace.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Workspace } from './schemas.ts';

/** A caller-chosen id makes workspace creation safe to retry. */
const WorkspaceCreation = wireStruct({ fields: { id: WorkspaceId, name: RecordName } });

/** Only installation administrators allocate a shared workspace and its daily allowance. */
export const createWorkspace = {
  method: HttpMethod.Post,
  path: '/v1/workspaces',
  access: Access.Principal,
  params: NoFields,
  query: NoFields,
  body: WorkspaceCreation,
  output: Workspace,
  errors: [ObjectUnavailable, InstallationAdministratorRequired, WorkspaceCreationConflict],
} as const satisfies Operation;
