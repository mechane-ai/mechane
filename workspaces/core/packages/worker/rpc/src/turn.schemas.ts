import { TurnStatus, UnansweredReason } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { Schema } from 'effect';
import { RECORD_TIME_KEYS } from './mech.schemas.ts';

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

type TurnRecord = typeof TurnRecord.Type;

/** What a turn read found, which decodes each state of the turn into the wire's turn. */
export const TurnAnswer = Schema.Union([
  Schema.TaggedStruct('Found', { turn: TurnRecord }),
  Schema.TaggedStruct('MechMissing', {}),
  Schema.TaggedStruct('TurnMissing', {}),
]);

export type TurnAnswer = typeof TurnAnswer.Type;

/** The requested turn page, a missing mech, or an unknown page cursor. */
export const TurnsAnswer = Schema.TaggedUnion({
  Listed: { turns: Schema.Array(TurnRecord), hasMore: Schema.Boolean },
  MechMissing: {},
  CursorMissing: {},
});

export type TurnsAnswer = typeof TurnsAnswer.Type;
