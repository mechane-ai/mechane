import { HttpMethod } from '@mechane/records';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { BOUNDED_TURN_OPERATION } from './bounded-turn-operation.ts';

/** A caller can retrieve the same durable work after its HTTP connection ends. */
export const showBoundedTurn = {
  ...BOUNDED_TURN_OPERATION,
  method: HttpMethod.Get,
  body: NoFields,
} as const satisfies Operation;
