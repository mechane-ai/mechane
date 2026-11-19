import { MechId, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { OPERATOR_MECH_READ } from '../mech-read.ts';
import { Routine, RoutineId, RoutineList } from './schemas.ts';

const RoutinePath = wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId, routineId: RoutineId } });
const RoutineQuery = Schema.Struct({ after: Schema.OptionFromOptionalKey(RoutineId) });

const ERRORS = [MechNotFound, RequestInvalid, ServiceUnavailable] as const;

export const ROUTINE_OPERATIONS = {
  showRoutine: {
    ...OPERATOR_MECH_READ,
    path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/routines/:routine_id',
    params: RoutinePath,
    query: NoFields,
    output: Routine,
    errors: ERRORS,
  },
  listRoutines: {
    ...OPERATOR_MECH_READ,
    path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/routines',
    query: RoutineQuery,
    output: RoutineList,
    errors: ERRORS,
  },
} as const satisfies Readonly<Record<string, Operation>>;
