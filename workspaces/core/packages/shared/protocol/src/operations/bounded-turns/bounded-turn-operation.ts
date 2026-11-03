import { BoundedTurnConflict, BoundedTurnNotFound } from '../../errors/bounded-turn.errors.ts';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { MechArchived } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import { BoundedTurn, BoundedTurnPath } from './schemas.ts';

/** Every bounded submission inherits its workspace membership and mech ownership boundary. */
export const BOUNDED_TURN_OPERATION = {
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/bounded-turns/:request_id',
  access: Access.Member,
  params: BoundedTurnPath,
  query: NoFields,
  output: BoundedTurn,
  errors: [MechNotFound, BoundedTurnNotFound, BoundedTurnConflict, MechArchived, ObjectUnavailable],
} as const;
