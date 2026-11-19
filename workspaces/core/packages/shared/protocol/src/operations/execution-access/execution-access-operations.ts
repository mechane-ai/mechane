import { HttpMethod, ManagedAgentId, PrincipalId, wireStruct, WorkspaceId } from '@mechane/records';
import { RequestInvalid, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MECH_AUTHORITY_OPERATION } from '../mech-authority-operation.ts';
import { ExecutionAccessChange, ExecutionAccessState } from './schemas.ts';

const ACCESS_OPERATION = {
  ...MECH_AUTHORITY_OPERATION,
  path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/execution-access',
  output: ExecutionAccessState,
} as const;

const COMMAND_ACCESS = {
  access: Access.Owner,
  path: '/api/operator/workspaces/:workspace_id/agents/:agent_id/command-access/:grantee_principal_id',
  params: wireStruct({
    fields: { workspaceId: WorkspaceId, agentId: ManagedAgentId, granteePrincipalId: PrincipalId },
  }),
  query: NoFields,
  output: ExecutionAccessState,
  errors: [RequestInvalid, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const;

/** Execution authority is configured by a current workspace owner, independently of model instructions. */
export const EXECUTION_ACCESS_OPERATIONS = {
  showManagedCommandAccess: { ...COMMAND_ACCESS, method: HttpMethod.Get, body: NoFields },
  configureManagedCommandAccess: { ...COMMAND_ACCESS, method: HttpMethod.Put, body: ExecutionAccessChange },
  showExecutionAccess: { ...ACCESS_OPERATION, method: HttpMethod.Get, body: NoFields },
  configureExecutionAccess: { ...ACCESS_OPERATION, method: HttpMethod.Put, body: ExecutionAccessChange },
} as const satisfies Readonly<Record<string, Operation>>;
