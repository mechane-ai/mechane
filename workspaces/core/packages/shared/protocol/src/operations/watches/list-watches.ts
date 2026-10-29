import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { WatchList } from './schemas.ts';

/** Lists saved schedules and their latest check outcomes for a mech. */
export const listWatches = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/watches',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: WatchList,
  errors: [MechNotFound, ObjectUnavailable],
} as const satisfies Operation;
