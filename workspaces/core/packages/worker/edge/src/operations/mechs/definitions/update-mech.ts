import { callMech } from '@mechane/bindings';
import { catalog, MechNotFound, MechRevisionConflict, ModelInvalid } from '@mechane/protocol';
import type { Mech, ObjectUnavailable } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { MechUpdateAnswer } from '@mechane/rpc';
import { Effect, Match, Option, Schema } from 'effect';
import type { WorkInput } from '../../../routing/types.ts';

/** Validates the requested model and submits a revision-checked definition update to the owning mech. */
export const updateMech = Effect.fn('updateMech')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.updateMech>): Effect.fn.Return<
  Mech,
  MechNotFound | MechRevisionConflict | ModelInvalid | ObjectUnavailable
> {
  const { workspaceId, mechId, ...change } = input;
  const offered = settings.modelOffers.map(({ id }) => id);
  const model = Option.fromUndefinedOr(change.model);

  if (Option.isSome(model) && !offered.includes(model.value)) {
    return yield* new ModelInvalid({ model: model.value, offered });
  }

  const encoded = Schema.encodeSync(catalog.updateMech.body)(change);
  const identity = MechId.make(mechId);

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.update({ change: encoded, updaterId: caller.principal.id }),
    answer: MechUpdateAnswer,
  });

  return yield* Match.valueTags(answer, {
    Updated: ({ mech }) => Effect.succeed(mech),
    MechMissing: () => new MechNotFound({ mechId }),
    Conflicting: ({ currentRevision }) =>
      new MechRevisionConflict({ mechId: identity, expectedRevision: change.expectedRevision, currentRevision }),
  });
});
