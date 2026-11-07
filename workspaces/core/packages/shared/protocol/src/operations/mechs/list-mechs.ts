import { HttpMethod, listQuery, RecordId } from '@mechane/records';
import { RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { MechPage } from './schemas.ts';

/** Lists the workspace's mechs a page at a time, oldest first. */
export const listMechs = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs',
  access: Access.Member,
  params: WorkspacePath,
  query: listQuery({ cursor: RecordId }),
  body: NoFields,
  output: MechPage,
  errors: [RequestInvalid, ServiceUnavailable],
} as const satisfies Operation;
