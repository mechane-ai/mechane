import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Allowance, WorkspacePath } from './schemas.ts';

/** Reads the workspace's allowance for the current UTC day, and what the day's dispatches have committed of it. */
export const showAllowance = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/allowance',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: NoFields,
  output: Allowance,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
