import { HttpMethod, listQuery, RecordId } from '@mechane/records';
import { MechNotFound, RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { SessionPage } from './schemas.ts';

/** Lists conversations without including the native AI SDK messages they contain. */
export const listSessions = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/sessions',
  access: Access.Member,
  params: MechPath,
  query: listQuery({ cursor: RecordId }),
  body: NoFields,
  output: SessionPage,
  errors: [MechNotFound, RequestInvalid, ServiceUnavailable],
} as const satisfies Operation;
