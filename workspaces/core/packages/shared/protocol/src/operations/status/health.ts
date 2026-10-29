import { HttpMethod } from '@mechane/records';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Health } from './schemas.ts';

/** Answers while the Worker serves requests; it calls no Durable Object. */
export const health = {
  method: HttpMethod.Get,
  path: '/health',
  access: Access.Public,
  params: NoFields,
  query: NoFields,
  body: NoFields,
  output: Health,
  errors: [],
} as const satisfies Operation;
