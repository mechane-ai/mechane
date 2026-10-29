import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { PrincipalAnswer } from './schemas.ts';

/** Reports the principal the caller's key acts for, and that key. */
export const showPrincipal = {
  method: HttpMethod.Get,
  path: '/v1/principal',
  access: Access.Principal,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: PrincipalAnswer,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
