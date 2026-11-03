import { callMech } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { BoundedTurnConflict, BoundedTurnNotFound, MechArchived, MechNotFound } from '@mechane/protocol';
import type { BoundedTurn, ObjectUnavailable } from '@mechane/protocol';
import type { BoundedRequestId, MechId, WorkspaceId } from '@mechane/records';
import { BoundedTurnAnswer } from '@mechane/rpc';
import type { MechRpc } from '@mechane/rpc';
import { Effect, Match } from 'effect';

type BoundedTurnIdentity = {
  readonly workspaceId: WorkspaceId;
  readonly mechId: MechId;
  readonly requestId: BoundedRequestId;
};

type BoundedTurnCall = { readonly mech: DurableObjectStub<MechRpc> };

type BoundedTurnResultInput = {
  readonly settings: WorkerSettings;
  readonly input: BoundedTurnIdentity;
  readonly call: (input: BoundedTurnCall) => Promise<typeof BoundedTurnAnswer.Encoded>;
};

/** Refusals retain the distinction between missing work, conflicting input, and an archived mech. */
export type BoundedTurnFailure = MechNotFound | BoundedTurnNotFound | BoundedTurnConflict | MechArchived;

/** Calls the admitted mech and translates its durable decision into the public result. */
export const boundedTurnResult = Effect.fn('boundedTurnResult')(function* ({
  settings,
  input: { workspaceId, mechId, requestId },
  call,
}: BoundedTurnResultInput): Effect.fn.Return<BoundedTurn, BoundedTurnFailure | ObjectUnavailable> {
  const answer = yield* callMech({ settings, workspaceId, mechId, call, answer: BoundedTurnAnswer });

  return yield* Match.valueTags(answer, {
    Found: ({ boundedTurn }) => Effect.succeed(boundedTurn),
    MechMissing: () => new MechNotFound({ mechId }),
    RequestMissing: () => new BoundedTurnNotFound({ requestId }),
    Conflicting: () => new BoundedTurnConflict({ requestId }),
    Archived: () => new MechArchived({ mechId }),
  });
});
