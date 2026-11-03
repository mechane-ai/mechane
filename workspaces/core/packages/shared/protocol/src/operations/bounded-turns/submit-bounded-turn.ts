import { HttpMethod } from '@mechane/records';
import type { Operation } from '../../operation/types.ts';
import { BOUNDED_TURN_OPERATION } from './bounded-turn-operation.ts';
import { BoundedTurnSubmission } from './schemas.ts';

/** The request ID reattaches to the original work; different input under that ID conflicts. */
export const submitBoundedTurn = {
  ...BOUNDED_TURN_OPERATION,
  method: HttpMethod.Post,
  body: BoundedTurnSubmission,
} as const satisfies Operation;
