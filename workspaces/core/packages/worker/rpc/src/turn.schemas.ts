import { EventPage, TurnReplyExcerpt, TurnStatus, TurnToolCall, UnansweredReason } from '@mechane/protocol';
import { RecordText, TurnId } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { RECORD_TIME_KEYS } from './mech.schemas.ts';

/** The fields of a turn in each of its states. */
const TURN_RECORD_FIELDS = {
  id: TurnId,
  inboxItemIds: Schema.Array(Schema.String),
  startedAt: Schema.DateTimeUtcFromMillis,
  definitionRevision: Schema.Int,
  inputExcerpt: Schema.optionalKey(RecordText),
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

/** The optional reply excerpt as an object read encodes it. */
export const TurnReplyRecord = Schema.OptionFromNullOr(TurnReplyExcerpt).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(null)),
);

export type TurnReplyRecord = typeof TurnReplyRecord.Type;

/** What a turn read found, which decodes each state of the turn into the wire's turn. */
export const TurnAnswer = Schema.Union([
  Schema.TaggedStruct('Found', {
    turn: TurnRecord,
    replyExcerpt: TurnReplyRecord,
    /** Absent when the object version does not expose tool evidence. */
    toolCalls: Schema.optionalKey(Schema.Array(TurnToolCall)),
    /** Absent when the object version does not expose evidence notices. */
    evidenceNotices: Schema.optionalKey(Schema.Array(RecordText)),
  }),
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

/** A bounded turn history, with missing-turn and missing-mech outcomes kept distinct. */
export const TurnEventsAnswer = Schema.TaggedUnion({ Listed: { page: EventPage }, MechMissing: {}, TurnMissing: {} });

export type TurnEventsAnswer = typeof TurnEventsAnswer.Type;
