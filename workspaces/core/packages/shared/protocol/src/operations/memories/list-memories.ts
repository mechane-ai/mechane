import { HttpMethod } from '@mechane/records';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { MemoryList } from './schemas.ts';

/** Lists the mech's committed memories, including changes saved by an unfinished or canceled run. */
export const listMemories = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/memories',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: MemoryList,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;
