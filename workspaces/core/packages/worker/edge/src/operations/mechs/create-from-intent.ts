import { callMech, callWorkspace } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { MechCreationConflict } from '@mechane/protocol';
import type { Mech, ObjectUnavailable } from '@mechane/protocol';
import type { CreationRequestId } from '@mechane/records';
import { MechCreationAnswer, MechRecord, MechSummaryRecord } from '@mechane/rpc';
import type { CreateMechInput } from '@mechane/rpc';
import { Effect, Option, Schema } from 'effect';

type CreateFromIntentInput = {
  readonly settings: WorkerSettings;
  readonly requestId: CreationRequestId;
  readonly fingerprint: string;
  readonly candidate: CreateMechInput;
};

/** Reuses the durable creation seed, creates its mech, and projects it into the workspace roster before answering. */
export const createFromIntent = Effect.fn('createFromIntent')(function* ({
  settings,
  requestId,
  fingerprint,
  candidate,
}: CreateFromIntentInput): Effect.fn.Return<Mech, MechCreationConflict | ObjectUnavailable> {
  const workspaceId = candidate.workspaceId;
  const seed = yield* prepareCreation({ settings, requestId, fingerprint, candidate });

  const mech = yield* callMech({
    settings,
    workspaceId,
    mechId: seed.mechId,
    call: ({ mech: stub }) => stub.create(seed),
    answer: MechRecord,
  });

  const entry = Schema.encodeSync(MechSummaryRecord)(mech);

  yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.indexMech({ mech: entry }),
    answer: Schema.Undefined,
  });

  return mech;
});

const prepareCreation = Effect.fn('prepareCreation')(function* ({
  settings,
  requestId,
  fingerprint,
  candidate,
}: CreateFromIntentInput): Effect.fn.Return<CreateMechInput, MechCreationConflict | ObjectUnavailable> {
  const seed = JSON.stringify(candidate);

  const intent = yield* callWorkspace({
    settings,
    workspaceId: candidate.workspaceId,
    call: ({ workspace }) => workspace.prepareMechCreation({ requestId, fingerprint, seed }),
    answer: MechCreationAnswer,
  });

  if (MechCreationAnswer.guards.Conflicting(intent)) {
    return yield* new MechCreationConflict({ requestId });
  }

  return { ...intent.seed, instructions: Option.getOrNull(intent.seed.instructions) };
});
