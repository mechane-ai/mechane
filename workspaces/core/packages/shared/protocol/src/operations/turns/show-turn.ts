import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable, TurnNotFound } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Trace, TurnPath } from './schemas.ts';

/** Reads one turn of a mech with its dispatches: what each model request reserved, used and was charged. */
export const showTurn = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/turns/:turn_id',
  access: Access.Member,
  params: TurnPath,
  query: NoFields,
  body: NoFields,
  output: Trace,
  errors: [MechNotFound, TurnNotFound, ObjectUnavailable],
} as const satisfies Operation;
