import { HttpMethod } from '@mechane/records';
import { DroneNotFound, MechBusy, MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { SandboxReport, SandboxRequest } from './schemas.ts';

/** Manages the mech's workspace, or one of its drones, through an idempotent maintenance request. */
export const manageSandbox = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/sandbox',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: SandboxRequest,
  output: SandboxReport,
  errors: [MechNotFound, DroneNotFound, MechBusy, ObjectUnavailable],
} as const satisfies Operation;
