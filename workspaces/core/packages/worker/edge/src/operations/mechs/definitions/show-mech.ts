import { callMech } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, Mech, ObjectUnavailable } from '@mechane/protocol';
import { MechAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../../routing/types.ts';

/** Reads the owning mech's current definition and lifecycle state. */
export const showMech = Effect.fn('showMech')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showMech>): Effect.fn.Return<Mech, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.show(),
    answer: MechAnswer,
  });

  return yield* Match.valueTags(answer, {
    Found: ({ mech }) => Effect.succeed(mech),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
