import type { BoundedTurn, catalog, ObjectUnavailable } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { boundedTurnResult } from './bounded-turn-result.ts';
import type { BoundedTurnFailure } from './bounded-turn-result.ts';

/** Retrieves durable evidence through the same membership boundary as the submission. */
export const showBoundedTurn = Effect.fn('showBoundedTurn')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showBoundedTurn>): Effect.fn.Return<BoundedTurn, BoundedTurnFailure | ObjectUnavailable> {
  return yield* boundedTurnResult({
    settings,
    input,
    call: ({ mech }) => mech.showBoundedTurn({ requestId: input.requestId }),
  });
});
