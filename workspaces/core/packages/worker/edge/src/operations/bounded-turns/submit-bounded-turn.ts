import { BoundedTurnSubmission } from '@mechane/protocol';
import type { BoundedTurn, catalog, ObjectUnavailable } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { boundedTurnResult } from './bounded-turn-result.ts';
import type { BoundedTurnFailure } from './bounded-turn-result.ts';

/** The mech records the caller's request before its alarm can execute it. */
export const submitBoundedTurn = Effect.fn('submitBoundedTurn')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.submitBoundedTurn>): Effect.fn.Return<BoundedTurn, BoundedTurnFailure | ObjectUnavailable> {
  const { requestId } = input;
  const submission = Schema.encodeSync(BoundedTurnSubmission)(input);

  return yield* boundedTurnResult({
    settings,
    input,
    call: ({ mech }) => mech.submitBoundedTurn({ requestId, submission, senderId: caller.principal.id }),
  });
});
