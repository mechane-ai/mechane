import { callMech } from '@mechane/bindings';
import { catalog, MechNotFound, RequestInvalid } from '@mechane/protocol';
import type { ObjectUnavailable, ThreadPage } from '@mechane/protocol';
import { ThreadsAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists a page of the threads the mech opened, which its object reads in one transaction without calling pi. */
export const listThreads = Effect.fn('listThreads')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listThreads>): Effect.fn.Return<
  ThreadPage,
  MechNotFound | RequestInvalid | ObjectUnavailable
> {
  const { workspaceId, mechId, after } = input;
  const query = Schema.encodeSync(catalog.listThreads.query)({ after });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.threads({ query }),
    answer: ThreadsAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ threads, hasMore }) => Effect.succeed({ threads, hasMore }),
    MechMissing: () => new MechNotFound({ mechId }),
    CursorMissing: () => new RequestInvalid({ reason: 'after names no thread of this mech' }),
  });
});
