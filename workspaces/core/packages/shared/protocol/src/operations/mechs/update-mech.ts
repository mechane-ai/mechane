import { ModelId } from '@mechane/deployment';
import { HttpMethod, Micros, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ModelInvalid, ObjectUnavailable } from '../../errors/errors.ts';
import { MechRevisionConflict } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { MechStatus } from './constants.ts';
import { DefinitionRevision, Instructions, Mech, MechName } from './schemas.ts';

const UpdateMechBody = wireStruct({
  fields: {
    expectedRevision: DefinitionRevision,
    name: Schema.optional(MechName),
    model: Schema.optional(ModelId),
    instructions: Schema.optional(Schema.OptionFromNullOr(Instructions)),
    dailyCapMicros: Schema.optional(Micros),
    status: Schema.optional(Schema.Enum(MechStatus)),
  },
});

/** Saves a definition only when the caller's expected revision still matches. */
export const updateMech = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/definition',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: UpdateMechBody,
  output: Mech,
  errors: [MechNotFound, MechRevisionConflict, ModelInvalid, ObjectUnavailable],
} as const satisfies Operation;
