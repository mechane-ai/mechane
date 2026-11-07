import { HttpMethod } from '@mechane/records';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Health } from './schemas.ts';

/** Answers while the server serves requests without contacting its dependencies. */
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
