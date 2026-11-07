import { HttpMethod } from '@mechane/records';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { Mech } from './schemas.ts';

/** Reads the mech definition, lifecycle, and saved and active revision numbers. */
export const showMech = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: Mech,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;
