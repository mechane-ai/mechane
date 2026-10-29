import { callMech, callWorkspace } from '@mechane/bindings';
import { MechNotFound, TurnNotFound, TurnStatus, UnansweredReason } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, Trace } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { RECORD_TIME_KEYS, WorkDispatchesAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** The fields of a turn in each of its states. */
const TURN_RECORD_FIELDS = {
  id: TurnId,
  inboxItemIds: Schema.Array(Schema.String),
  startedAt: Schema.DateTimeUtcFromMillis,
  definitionRevision: Schema.Int,
} as const;

/** A turn as the mech's object answers it, by its status: its unended fields are null. */
const TurnRecord = Schema.Union([
  Schema.Struct({ ...TURN_RECORD_FIELDS, status: Schema.Literal(TurnStatus.Running) }).pipe(
    Schema.encodeKeys(RECORD_TIME_KEYS),
  ),
  Schema.Struct({
    ...TURN_RECORD_FIELDS,
    status: Schema.Literal(TurnStatus.Answered),
    endedAt: Schema.DateTimeUtcFromMillis,
  }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
  Schema.Struct({
    ...TURN_RECORD_FIELDS,
    status: Schema.Literal(TurnStatus.Unanswered),
    endedAt: Schema.DateTimeUtcFromMillis,
    reason: Schema.Enum(UnansweredReason),
  }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
]);

/** What a turn read found, which decodes each state of the turn into the wire's turn. */
const TurnAnswer = Schema.Union([
  Schema.TaggedStruct('Found', { turn: TurnRecord }),
  Schema.TaggedStruct('MechMissing', {}),
  Schema.TaggedStruct('TurnMissing', {}),
]);

type TurnAnswer = typeof TurnAnswer.Type;

/** Joins a turn, which the mech keeps, with its dispatches, which the workspace's ledger keeps. */
export const showTurn = Effect.fn('showTurn')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showTurn>): Effect.fn.Return<Trace, MechNotFound | TurnNotFound | ObjectUnavailable> {
  const { workspaceId, mechId, turnId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.turn({ turnId }),
    answer: TurnAnswer,
  });

  const turn = yield* Match.valueTags(answer, {
    Found: (found) => Effect.succeed(found.turn),
    MechMissing: () => new MechNotFound({ mechId }),
    TurnMissing: () => new TurnNotFound({ turnId }),
  });

  const dispatches = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.workDispatches({ mechId, workId: turnId }),
    answer: WorkDispatchesAnswer,
  });

  return { turn, dispatches };
});
