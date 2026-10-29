import { Schema } from 'effect';

const SlackIdentifier = Schema.NonEmptyString;

/** The operator-assigned identity of an existing Slack installation. */
export const SlackConnectionId = SlackIdentifier.pipe(Schema.brand('SlackConnectionId'));
export type SlackConnectionId = typeof SlackConnectionId.Type;
/** The Slack workspace identity authenticated by its event envelope. */
export const SlackTeamId = SlackIdentifier.pipe(Schema.brand('SlackTeamId'));
export type SlackTeamId = typeof SlackTeamId.Type;
/** The Slack conversation identity used to freeze an audience. */
export const SlackChannelId = SlackIdentifier.pipe(Schema.brand('SlackChannelId'));
export type SlackChannelId = typeof SlackChannelId.Type;
/** The Slack user identity used to suppress self messages and verify reconciliation evidence. */
export const SlackUserId = SlackIdentifier.pipe(Schema.brand('SlackUserId'));
export type SlackUserId = typeof SlackUserId.Type;
/** The provider event identity used alongside message identity for durable deduplication. */
export const SlackEventId = SlackIdentifier.pipe(Schema.brand('SlackEventId'));
export type SlackEventId = typeof SlackEventId.Type;
