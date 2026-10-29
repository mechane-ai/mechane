import { CreationRequestId, HttpMethod, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { MechCreationConflict } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { Mech, MechName } from './schemas.ts';

const CloneMechBody = wireStruct({ fields: { name: MechName, requestId: Schema.optional(CreationRequestId) } });

/** Copies a definition into a separate mech with no inherited conversation or operational authority. */
export const cloneMech = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/clone',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: CloneMechBody,
  output: Mech,
  errors: [MechNotFound, MechCreationConflict, ObjectUnavailable],
} as const satisfies Operation;
