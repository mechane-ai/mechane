import { HttpMethod } from '@mechane/records';
import { ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Readiness } from './schemas.ts';

export const readiness = {
  method: HttpMethod.Get,
  path: '/api/v1/readiness',
  access: Access.Public,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: Readiness,
  errors: [ServiceUnavailable],
} as const satisfies Operation;
