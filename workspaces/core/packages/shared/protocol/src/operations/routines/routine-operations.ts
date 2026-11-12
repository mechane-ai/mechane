import { HttpMethod, MechId, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, RequestConflict, RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { ExpectedRoutineRevision, Routine, RoutineId, RoutineList, RoutineRequest } from './schemas.ts';

const RoutinePath = wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId, routineId: RoutineId } });
const RoutineQuery = Schema.Struct({ after: Schema.OptionFromOptionalKey(RoutineId) });

const DeleteQuery = wireStruct({
  fields: { expectedRevision: Schema.NumberFromString.pipe(Schema.decodeTo(ExpectedRoutineRevision)) },
});

const ERRORS = [MechNotFound, RequestConflict, RequestInvalid, ServiceUnavailable] as const;

export const ROUTINE_OPERATIONS = {
  putRoutine: {
    method: HttpMethod.Put,
    path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/routines/:routine_id',
    access: Access.Member,
    params: RoutinePath,
    query: NoFields,
    body: RoutineRequest,
    output: Routine,
    errors: ERRORS,
  },
  showRoutine: {
    method: HttpMethod.Get,
    path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/routines/:routine_id',
    access: Access.Member,
    params: RoutinePath,
    query: NoFields,
    body: NoFields,
    output: Routine,
    errors: ERRORS,
  },
  listRoutines: {
    method: HttpMethod.Get,
    path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/routines',
    access: Access.Member,
    params: MechPath,
    query: RoutineQuery,
    body: NoFields,
    output: RoutineList,
    errors: ERRORS,
  },
  deleteRoutine: {
    method: HttpMethod.Delete,
    path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/routines/:routine_id',
    access: Access.Member,
    params: RoutinePath,
    query: DeleteQuery,
    body: NoFields,
    output: Routine,
    errors: ERRORS,
  },
} as const satisfies Readonly<Record<string, Operation>>;
