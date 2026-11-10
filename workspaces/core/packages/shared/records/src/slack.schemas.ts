import { Schema } from 'effect';
import { SlackBindingId } from './entity.schemas.ts';
import {
  SlackChannelId,
  SlackConnectionId,
  SlackEventId,
  SlackTeamId,
  SlackUserId,
} from './slack-identifiers.schemas.ts';
import { SlackOriginKind } from './slack.constants.ts';

/** A trusted, fixed Slack audience and optional thread anchor. */
export const SlackDestination = Schema.Struct({
  bindingId: SlackBindingId,
  connectionId: SlackConnectionId,
  teamId: SlackTeamId,
  channelId: SlackChannelId,
  /** Absent for a new top-level notification. */
  threadTimestamp: Schema.OptionFromNullOr(Schema.NonEmptyString),
});

export type SlackDestination = typeof SlackDestination.Type;

/** Signed attachment metadata; the private URL still requires a host-owned Slack credential. */
export const SlackAttachment = Schema.Struct({
  id: Schema.NonEmptyString,
  /** Absent when Slack supplies no file name. */
  name: Schema.OptionFromNullOr(Schema.NonEmptyString),
  /** Absent when Slack does not declare the file's media type. */
  mediaType: Schema.OptionFromNullOr(Schema.NonEmptyString),
  /** Absent when Slack supplies no private download URL. */
  url: Schema.OptionFromNullOr(Schema.NonEmptyString),
});

export type SlackAttachment = typeof SlackAttachment.Type;

/** Routing facts verified by the connector, never accepted from a model or an ordinary inbox caller. */
export const SlackInboxOrigin = Schema.Struct({
  kind: Schema.Literal(SlackOriginKind.Slack),
  eventId: SlackEventId,
  messageTimestamp: Schema.NonEmptyString,
  userId: SlackUserId,
  destination: SlackDestination,
  /** Omitted on origins stored before attachment intake was supported. */
  attachments: Schema.optionalKey(Schema.Array(SlackAttachment)),
});

export type SlackInboxOrigin = typeof SlackInboxOrigin.Type;
