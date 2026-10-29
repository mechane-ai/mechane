import { ModelInvalid } from '@mechane/protocol';
import type { catalog, Mech, MechCreationConflict, ObjectUnavailable } from '@mechane/protocol';
import { CreationRequestId, MechId } from '@mechane/records';
import { Effect, Option } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { createFromIntent } from './create-from-intent.ts';

/** The input of a mech's creation. */
type CreateMechInput = WorkInput<typeof catalog.createMech>;

/**
 * Creates a mech under an id the Worker makes, with the model and the cap its creator named, or else the deployment's
 * first offer and default cap. It adds the mech to its workspace's index before answering, and refuses a model the
 * deployment does not offer.
 */
export const createMech = Effect.fn('createMech')(function* ({
  input,
  settings,
  caller,
}: CreateMechInput): Effect.fn.Return<Mech, MechCreationConflict | ModelInvalid | ObjectUnavailable> {
  const { workspaceId, name } = input;
  const mechId = MechId.make(crypto.randomUUID());
  const creatorId = caller.principal.id;
  const requestedId = Option.fromUndefinedOr(input.requestId);
  const freshId = CreationRequestId.make(crypto.randomUUID());
  const requestId = Option.getOrElse(requestedId, () => freshId);
  const mission = Option.fromUndefinedOr(input.instructions);
  const instructions = Option.getOrNull(mission);
  const requestedCap = Option.fromUndefinedOr(input.dailyCapMicros);
  const dailyCapMicros = Option.getOrElse(requestedCap, () => settings.mechDailyCapMicros);
  const requestedModel = Option.fromUndefinedOr(input.model);
  const model = Option.getOrElse(requestedModel, () => settings.modelOffers[0].id);
  const offered = settings.modelOffers.map((offer) => offer.id);

  if (!offered.includes(model)) {
    return yield* new ModelInvalid({ model, offered });
  }

  const fingerprint = creationFingerprint({ input, caller });

  return yield* createFromIntent({
    settings,
    requestId,
    fingerprint,
    candidate: { workspaceId, mechId, name, model, instructions, creatorId, dailyCapMicros },
  });
});

function creationFingerprint({ input, caller }: Pick<CreateMechInput, 'input' | 'caller'>): string {
  const instructions = Option.fromUndefinedOr(input.instructions);
  const model = Option.fromUndefinedOr(input.model);
  const dailyCapMicros = Option.fromUndefinedOr(input.dailyCapMicros);

  return JSON.stringify({
    operation: 'create',
    creatorId: caller.principal.id,
    name: input.name,
    instructions: Option.getOrNull(instructions),
    model: Option.getOrNull(model),
    dailyCapMicros: Option.getOrNull(dailyCapMicros),
  });
}
