import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Readiness } from './schemas.ts';

/** Reports the deployment's release and revisions; it answers only after every Durable Object answers. */
export const readiness = {
  method: HttpMethod.Get,
  path: '/v1/readiness',
  access: Access.Public,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: Readiness,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
