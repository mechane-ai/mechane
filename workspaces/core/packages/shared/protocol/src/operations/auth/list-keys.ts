import { HttpMethod, listQuery, RecordId } from '@mechane/records';
import { ObjectUnavailable, RequestInvalid } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { KeyPage } from './schemas.ts';

/** Lists the caller's own keys a page at a time, oldest first, revoked and expired ones included. */
export const listKeys = {
  method: HttpMethod.Get,
  path: '/v1/keys',
  access: Access.Principal,
  params: NoFields,
  query: listQuery({ cursor: RecordId }),
  body: NoFields,
  output: KeyPage,
  errors: [RequestInvalid, ObjectUnavailable],
} as const satisfies Operation;
