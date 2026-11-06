import { HttpMethod } from '@mechane/records';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MECH_AUTHORITY_OPERATION } from '../mech-authority-operation.ts';
import { ExecutionAccessChange, ExecutionAccessState } from './schemas.ts';

const ACCESS_OPERATION = {
  ...MECH_AUTHORITY_OPERATION,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/execution-access',
  output: ExecutionAccessState,
} as const;

/** Execution authority is configured by a current workspace owner, independently of model instructions. */
export const EXECUTION_ACCESS_OPERATIONS = {
  showExecutionAccess: { ...ACCESS_OPERATION, method: HttpMethod.Get, body: NoFields },
  configureExecutionAccess: { ...ACCESS_OPERATION, method: HttpMethod.Put, body: ExecutionAccessChange },
} as const satisfies Readonly<Record<string, Operation>>;
