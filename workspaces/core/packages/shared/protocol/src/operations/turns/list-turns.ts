import { HttpMethod, listQuery, PAGE_RENAMES, renamedWireStruct, TurnId } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ObjectUnavailable, RequestInvalid } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { Turn, UnknownTurn } from './schemas.ts';

/** A bounded page of a mech's turns, newest first. */
export const TurnPage = renamedWireStruct({
  fields: { turns: Schema.Array(Schema.Union([Turn, UnknownTurn])), hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type TurnPage = typeof TurnPage.Type;

/** The newest turns first; the cursor continues toward older work. */
export const listTurns = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/turns',
  access: Access.Member,
  params: MechPath,
  query: listQuery({ cursor: TurnId }),
  body: NoFields,
  output: TurnPage,
  errors: [RequestInvalid, MechNotFound, ObjectUnavailable],
} as const satisfies Operation;
