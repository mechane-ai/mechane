import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable, TurnEnded, TurnNotFound } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { TurnCancel, TurnPath } from './schemas.ts';

/**
 * Cancels a running turn of a mech: it ends without a reply, and none of its memory changes save. A cancel of a turn
 * already canceled answers that first cancel, so a retry is safe; a turn that ended before any cancel conflicts.
 */
export const cancelTurn = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/turns/:turn_id/cancel',
  access: Access.Member,
  params: TurnPath,
  query: NoFields,
  body: NoFields,
  output: TurnCancel,
  errors: [MechNotFound, TurnNotFound, TurnEnded, ObjectUnavailable],
} as const satisfies Operation;
