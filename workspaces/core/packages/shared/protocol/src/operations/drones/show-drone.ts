import { HttpMethod } from '@mechane/records';
import { DroneNotFound, MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { DronePath, DroneTrace } from './schemas.ts';

/** Reads one drone of a mech with its brief and its dispatches: what each model request reserved, used and cost. */
export const showDrone = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/drones/:drone_id',
  access: Access.Member,
  params: DronePath,
  query: NoFields,
  body: NoFields,
  output: DroneTrace,
  errors: [MechNotFound, DroneNotFound, ObjectUnavailable],
} as const satisfies Operation;
