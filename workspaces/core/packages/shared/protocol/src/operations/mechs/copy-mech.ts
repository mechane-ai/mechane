import { CreationRequestId, HttpMethod, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { MechBusy, MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { MechCreationConflict } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { Mech, MechName } from './schemas.ts';

const CopyMechBody = wireStruct({ fields: { name: MechName, requestId: Schema.optional(CreationRequestId) } });

const COPY_MECH_FIELDS = {
  method: HttpMethod.Post,
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: CopyMechBody,
  output: Mech,
} as const;

/** Copies a definition into a separate mech with no inherited conversation or operational authority. */
export const cloneMech = {
  ...COPY_MECH_FIELDS,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/clone',
  errors: [MechNotFound, MechCreationConflict, ServiceUnavailable],
} as const satisfies Operation;

/** Copies an idle mech's context and history. Sandbox files and operational authority stay with the source. */
export const forkMech = {
  ...COPY_MECH_FIELDS,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/fork',
  errors: [MechNotFound, MechBusy, MechCreationConflict, ServiceUnavailable],
} as const satisfies Operation;
