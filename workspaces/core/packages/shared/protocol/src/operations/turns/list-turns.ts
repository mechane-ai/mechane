import { PAGE_RENAMES, renamedWireStruct, searchableListQuery, TurnId } from '@mechane/records';
import { Schema } from 'effect';
import { RequestInvalid } from '../../errors/errors.ts';
import type { Operation } from '../../operation/types.ts';
import { OPERATOR_MECH_READ } from '../mech-read.ts';
import { TurnRuntimeSource, TurnStatus } from './constants.ts';
import { Turn, UnknownTurn } from './schemas.ts';

const Filter = Schema.Enum({ ...TurnStatus, Imported: TurnRuntimeSource.Imported });

/** A bounded page of a mech's turns, newest first. */
export const TurnPage = renamedWireStruct({
  fields: { turns: Schema.Array(Schema.Union([Turn, UnknownTurn])), hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type TurnPage = typeof TurnPage.Type;

/** The newest turns first; the cursor continues toward older work. */
export const listTurns = {
  ...OPERATOR_MECH_READ,
  path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/turns',
  query: searchableListQuery({ cursor: TurnId, filter: Filter }),
  output: TurnPage,
  errors: [RequestInvalid, ...OPERATOR_MECH_READ.errors],
} as const satisfies Operation;
