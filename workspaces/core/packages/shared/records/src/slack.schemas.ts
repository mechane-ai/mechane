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

/** Routing facts verified by the connector, never accepted from a model or an ordinary inbox caller. */
export const SlackInboxOrigin = Schema.Struct({
  kind: Schema.Literal(SlackOriginKind.Slack),
  eventId: SlackEventId,
  messageTimestamp: Schema.NonEmptyString,
  userId: SlackUserId,
  destination: SlackDestination,
});

export type SlackInboxOrigin = typeof SlackInboxOrigin.Type;
