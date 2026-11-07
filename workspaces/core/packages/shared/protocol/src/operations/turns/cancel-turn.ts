import { HttpMethod } from '@mechane/records';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { TurnEnded, TurnNotFound } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { TurnCancel, TurnPath } from './schemas.ts';

/** Stops future work while retaining committed effects; repeating the same cancellation returns its receipt. */
export const cancelTurn = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/turns/:turn_id/cancel',
  access: Access.Member,
  params: TurnPath,
  query: NoFields,
  body: NoFields,
  output: TurnCancel,
  errors: [MechNotFound, TurnNotFound, TurnEnded, ServiceUnavailable],
} as const satisfies Operation;
