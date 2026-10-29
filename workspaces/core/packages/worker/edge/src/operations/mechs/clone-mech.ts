import type { catalog, Mech, MechCreationConflict, MechNotFound, ObjectUnavailable } from '@mechane/protocol';
import { CreationRequestId, MechId } from '@mechane/records';
import type { CreateMechInput } from '@mechane/rpc';
import { Effect, Option } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { createFromIntent } from './create-from-intent.ts';
import { showMech } from './definitions/show-mech.ts';

type CloneSeedInput = Pick<CreateMechInput, 'workspaceId' | 'creatorId' | 'name'> & { readonly source: Mech };

/** Copies the selected definition through a durable creation intent so retries keep the same destination identity. */
export const cloneMech = Effect.fn('cloneMech')(function* ({
  settings,
  input,
  caller,
  peer,
}: WorkInput<typeof catalog.cloneMech>): Effect.fn.Return<
  Mech,
  MechNotFound | MechCreationConflict | ObjectUnavailable
> {
  const { workspaceId, mechId, name } = input;
  const source = yield* showMech({ settings, input: { workspaceId, mechId }, caller, peer });
  const creatorId = caller.principal.id;
  const requestedId = Option.fromUndefinedOr(input.requestId);
  const freshId = CreationRequestId.make(crypto.randomUUID());
  const requestId = Option.getOrElse(requestedId, () => freshId);
  const fingerprint = JSON.stringify({ operation: 'clone', creatorId, sourceMechId: mechId, name });
  const candidate = cloneSeed({ workspaceId, creatorId, name, source });

  return yield* createFromIntent({ settings, requestId, fingerprint, candidate });
});

function cloneSeed({ source, ...identity }: CloneSeedInput): CreateMechInput {
  return {
    ...identity,
    mechId: MechId.make(crypto.randomUUID()),
    model: source.model,
    instructions: Option.getOrNull(source.instructions),
    dailyCapMicros: source.dailyCapMicros,
  };
}
