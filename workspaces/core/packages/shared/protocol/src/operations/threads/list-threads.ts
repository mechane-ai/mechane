import { HttpMethod, listQuery, ThreadId } from '@mechane/records';
import { MechNotFound, ObjectUnavailable, RequestInvalid } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { ThreadPage } from './schemas.ts';

/**
 * Lists every thread a mech opened a page at a time, oldest first, resolved ones included, as the mech last updated
 * each.
 */
export const listThreads = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/threads',
  access: Access.Member,
  params: MechPath,
  query: listQuery({ cursor: ThreadId }),
  body: NoFields,
  output: ThreadPage,
  errors: [MechNotFound, RequestInvalid, ObjectUnavailable],
} as const satisfies Operation;
