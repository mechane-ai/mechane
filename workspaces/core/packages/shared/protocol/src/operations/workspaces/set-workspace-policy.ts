import { HttpMethod, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ObjectUnavailable, RequestInvalid, WorkspaceNotFound } from '../../errors/errors.ts';
import { InstallationAdministratorRequired, WorkspacePolicyConflict } from '../../errors/workspace.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePolicy } from './policy.schemas.ts';
import { WorkspacePath } from './schemas.ts';

const WorkspacePolicyUpdate = renamedWireStruct({
  fields: {
    policy: WorkspacePolicy,
    /** Omission permits replacement; true refuses an import when policy already exists. */
    isCreateOnly: Schema.optionalKey(Schema.Boolean),
  },
  renames: { isCreateOnly: 'create_only' },
});

type WorkspacePolicyUpdate = typeof WorkspacePolicyUpdate.Type;

/** Installation administrators change workspace policy within the installation's global limits. */
export const setWorkspacePolicy = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/policy',
  access: Access.Principal,
  params: WorkspacePath,
  query: NoFields,
  body: WorkspacePolicyUpdate,
  output: WorkspacePolicy,
  errors: [
    ObjectUnavailable,
    RequestInvalid,
    InstallationAdministratorRequired,
    WorkspaceNotFound,
    WorkspacePolicyConflict,
  ],
} as const satisfies Operation;
