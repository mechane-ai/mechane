import { HttpMethod } from '@mechane/records';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { MemoryList } from './schemas.ts';

/**
 * Lists every memory a mech saved, by path and with its text, for its members to review. It holds only what a turn's
 * reply saved, never the changes of a turn still running or one that ended without a reply. A mech keeps at most
 * `MEMORIES_PER_MECH` memories, so the list comes whole.
 */
export const listMemories = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/memories',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: MemoryList,
  errors: [MechNotFound, ObjectUnavailable],
} as const satisfies Operation;
