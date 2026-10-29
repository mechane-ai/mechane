import {
  DurationFromSeconds,
  renamedWireStruct,
  SlackChannelId,
  SlackEventId,
  SlackTeamId,
  SlackUserId,
} from '@mechane/records';
import { Schema } from 'effect';
import { SlackEnvelopeType, SlackMessageType } from './constants.ts';

/** The signed event envelope fields needed for audience validation and deduplication. */
export const SlackEventCallback = Schema.Struct({
  type: Schema.Literal(SlackEnvelopeType.EventCallback),
  team_id: SlackTeamId,
  event_id: SlackEventId,
  event: Schema.Unknown,
});

export type SlackEventCallback = typeof SlackEventCallback.Type;

/** The URL verification and event envelopes accepted by this connector. */
export const SlackEnvelope = Schema.Union([
  Schema.Struct({ type: Schema.Literal(SlackEnvelopeType.UrlVerification), challenge: Schema.NonEmptyString }),
  SlackEventCallback,
]);

export type SlackEnvelope = typeof SlackEnvelope.Type;

/** The provider message fields needed to admit text and preserve its original thread. */
export const SlackMessage = Schema.Struct({
  type: Schema.Literals([SlackMessageType.Message, SlackMessageType.Mention]),
  channel: SlackChannelId,
  user: SlackUserId,
  text: Schema.String,
  ts: Schema.NonEmptyString,
  /** Absent when the incoming message starts a new thread. */
  thread_ts: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  /** Absent when Slack does not mark the message as bot-authored. */
  bot_id: Schema.OptionFromOptionalKey(Schema.String),
  /** Absent for an ordinary newly posted message. */
  subtype: Schema.OptionFromOptionalKey(Schema.String),
});

export type SlackMessage = typeof SlackMessage.Type;

/** The provider response fields needed to establish whether a write was confirmed. */
export const SlackResponse = renamedWireStruct({
  fields: {
    isOk: Schema.Boolean,
    /** Absent when the provider supplies no failure code. */
    error: Schema.OptionFromOptionalKey(Schema.String),
    /** Absent when the provider does not confirm a message timestamp. */
    ts: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
    /** Absent when the provider does not confirm a destination. */
    channel: Schema.OptionFromOptionalKey(SlackChannelId),
  },
  renames: { isOk: 'ok' },
});

export type SlackResponse = typeof SlackResponse.Type;

/** History evidence and pagination used solely to reconcile an uncertain delivery. */
export const SlackHistory = renamedWireStruct({
  fields: {
    isOk: Schema.Boolean,
    /** Absent when history is unavailable or the provider returns no message array. */
    messages: Schema.OptionFromOptionalKey(
      Schema.Array(
        Schema.Struct({
          ts: Schema.NonEmptyString,
          /** Absent when the history entry has no user identity. */
          user: Schema.OptionFromOptionalKey(SlackUserId),
          /** Absent when the message has no provider metadata. */
          metadata: Schema.OptionFromOptionalKey(
            Schema.Struct({ event_type: Schema.String, event_payload: Schema.Record(Schema.String, Schema.Unknown) }),
          ),
        }),
      ),
    ),
    /** Absent when the provider supplies no additional-page indicator. */
    has_more: Schema.OptionFromOptionalKey(Schema.Boolean),
    /** Absent when the provider supplies no pagination metadata. */
    response_metadata: Schema.OptionFromOptionalKey(
      Schema.Struct({
        /** Absent when there is no continuation cursor. */
        next_cursor: Schema.OptionFromOptionalKey(Schema.String),
      }),
    ),
  },
  renames: { isOk: 'ok' },
});

export type SlackHistory = typeof SlackHistory.Type;

/** A confirmed write, definite refusal, rate-limit deferral, or ambiguous outcome. */
export const SlackPostResult = Schema.TaggedUnion({
  Sent: { messageTimestamp: Schema.NonEmptyString },
  Deferred: { retryAfter: DurationFromSeconds },
  Uncertain: { reason: Schema.NonEmptyString },
  Blocked: { reason: Schema.NonEmptyString },
});

export type SlackPostResult = typeof SlackPostResult.Type;
