import { callMech } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, MechRevisionPage, ObjectUnavailable } from '@mechane/protocol';
import { MechRevisionsAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../../routing/types.ts';

/** Reads a revision page from the owning mech and reports a missing resource through the API. */
export const listMechRevisions = Effect.fn('listMechRevisions')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listMechRevisions>): Effect.fn.Return<MechRevisionPage, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId, after } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.revisions({ after }),
    answer: MechRevisionsAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ revisions, hasMore }) => Effect.succeed({ revisions, hasMore }),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
