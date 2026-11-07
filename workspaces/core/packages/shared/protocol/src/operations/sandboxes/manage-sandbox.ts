import { HttpMethod } from '@mechane/records';
import { SandboxReport, SandboxRequest } from '@mechane/sandbox-wire';
import { MechBusy, MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { SandboxCapacityReached, SandboxDisabled } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';

/** Manages the mech's persistent sandbox through an idempotent maintenance request. */
export const manageSandbox = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/sandbox',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: SandboxRequest,
  output: SandboxReport,
  errors: [MechNotFound, MechBusy, ServiceUnavailable, SandboxDisabled, SandboxCapacityReached],
} as const satisfies Operation;
