import { HttpMethod } from '@mechane/records';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { BOUNDED_TURN_OPERATION } from './bounded-turn-operation.ts';

/** Cancellation covers waiting work and running work; terminal results remain retrievable. */
export const cancelBoundedTurn = {
  ...BOUNDED_TURN_OPERATION,
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/bounded-turns/:request_id/cancel',
  body: NoFields,
} as const satisfies Operation;
