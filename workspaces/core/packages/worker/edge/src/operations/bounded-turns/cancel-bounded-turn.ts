import type { BoundedTurn, catalog, ObjectUnavailable } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { boundedTurnResult } from './bounded-turn-result.ts';
import type { BoundedTurnFailure } from './bounded-turn-result.ts';

/** Records the caller's cancellation; the mech's alarm owns stopping execution. */
export const cancelBoundedTurn = Effect.fn('cancelBoundedTurn')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.cancelBoundedTurn>): Effect.fn.Return<BoundedTurn, BoundedTurnFailure | ObjectUnavailable> {
  return yield* boundedTurnResult({
    settings,
    input,
    call: ({ mech }) => mech.cancelBoundedTurn({ requestId: input.requestId, cancelerId: caller.principal.id }),
  });
});
