import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { WatchNotFound } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WatchPath } from '../schemas.ts';
import { FindingList } from './schemas.ts';

/** Lists the current durable findings of one watch. */
export const listFindings = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/watches/:watch_id/findings',
  access: Access.Member,
  params: WatchPath,
  query: NoFields,
  body: NoFields,
  output: FindingList,
  errors: [MechNotFound, WatchNotFound, ObjectUnavailable],
} as const satisfies Operation;
