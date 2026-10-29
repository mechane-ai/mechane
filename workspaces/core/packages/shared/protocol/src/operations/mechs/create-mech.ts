import { ModelId } from '@mechane/deployment';
import { CreationRequestId, HttpMethod, Micros, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ModelInvalid, ObjectUnavailable } from '../../errors/errors.ts';
import { MechCreationConflict } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { Instructions, Mech, MechName } from './schemas.ts';

/** A mech to create; without a model, it gets the deployment's first offer, and without a cap, its default cap. */
const CreateMechBody = wireStruct({
  fields: {
    name: MechName,
    instructions: Schema.optional(Instructions),
    model: Schema.optional(ModelId),
    dailyCapMicros: Schema.optional(Micros),
    requestId: Schema.optional(CreationRequestId),
  },
});

type CreateMechBody = typeof CreateMechBody.Type;

/** Creates a mech in the workspace, under an id the deployment makes, with a model the deployment offers. */
export const createMech = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs',
  access: Access.Member,
  params: WorkspacePath,
  query: NoFields,
  body: CreateMechBody,
  output: Mech,
  errors: [MechCreationConflict, ModelInvalid, ObjectUnavailable],
} as const satisfies Operation;
