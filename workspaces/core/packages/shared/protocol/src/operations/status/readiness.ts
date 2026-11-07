import { HttpMethod } from '@mechane/records';
import { ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Readiness } from './schemas.ts';

/** Reports the deployment's release and database revision after the server and its workflow worker are ready. */
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
