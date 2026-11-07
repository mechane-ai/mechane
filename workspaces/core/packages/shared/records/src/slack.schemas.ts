import { Schema } from 'effect';
import { SlackBindingId } from './entity.schemas.ts';
import { SlackChannelId, SlackConnectionId, SlackTeamId } from './slack-identifiers.schemas.ts';

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
