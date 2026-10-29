import { callMech } from '@mechane/bindings';
import { MechBusy, MechNotFound } from '@mechane/protocol';
import type { catalog, Mech, ObjectUnavailable } from '@mechane/protocol';
import { ForkAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/**
 * Forks a mech for the caller under an id the Worker makes. The mech decides, copies itself into the new mech and
 * indexes it in the workspace before answering. A fork it began and never ended keeps that fork's id, so a retry
 * finishes the same new mech.
 */
export const forkMech = Effect.fn('forkMech')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.forkMech>): Effect.fn.Return<Mech, MechNotFound | MechBusy | ObjectUnavailable> {
  const { workspaceId, mechId, name } = input;
  const forkId = crypto.randomUUID();

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.fork({ forkId, name, requesterId: caller.principal.id }),
    answer: ForkAnswer,
  });

  return yield* Match.valueTags(answer, {
    Forked: ({ mech }) => Effect.succeed(mech),
    MechMissing: () => new MechNotFound({ mechId }),
    Busy: () => new MechBusy({ mechId }),
  });
});
