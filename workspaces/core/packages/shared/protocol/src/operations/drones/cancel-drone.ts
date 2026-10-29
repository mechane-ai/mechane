import { HttpMethod } from '@mechane/records';
import { DroneEnded, DroneNotFound, MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { DroneCancel, DronePath } from './schemas.ts';

/**
 * Cancels a running drone of a mech: it ends unreported, canceled, and its mech receives an item saying so. A cancel of
 * a drone already canceled answers that first cancel, so a retry is safe; a drone that ended before any cancel
 * conflicts.
 */
export const cancelDrone = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/drones/:drone_id/cancel',
  access: Access.Member,
  params: DronePath,
  query: NoFields,
  body: NoFields,
  output: DroneCancel,
  errors: [MechNotFound, DroneNotFound, DroneEnded, ObjectUnavailable],
} as const satisfies Operation;
