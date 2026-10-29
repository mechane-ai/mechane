import { DroneId, HttpMethod, listQuery } from '@mechane/records';
import { MechNotFound, ObjectUnavailable, RequestInvalid } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { DronePage } from './schemas.ts';

/** Lists every drone a mech started a page at a time, oldest first, running and ended alike. */
export const listDrones = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/drones',
  access: Access.Member,
  params: MechPath,
  query: listQuery({ cursor: DroneId }),
  body: NoFields,
  output: DronePage,
  errors: [MechNotFound, RequestInvalid, ObjectUnavailable],
} as const satisfies Operation;
