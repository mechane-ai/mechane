import {
  MechId,
  SlackBindingId,
  SlackChannelId,
  SlackConnectionId,
  SlackDeliveryId,
  SlackDeliveryStatus,
  SlackDestination,
  SlackTeamId,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';

/** One fixed Slack audience and agent, with independent listening and reply controls. */
export const SlackBinding = wireStruct({
  fields: {
    id: SlackBindingId,
    connectionId: SlackConnectionId,
    teamId: SlackTeamId,
    channelId: SlackChannelId,
    mechId: MechId,
    isListening: Schema.Boolean,
    isReplyEnabled: Schema.Boolean,
  },
});

export type SlackBinding = typeof SlackBinding.Type;

/** The configured Slack audiences of a workspace. */
export const SlackBindings = Schema.Struct({ bindings: Schema.Array(SlackBinding) });
export type SlackBindings = typeof SlackBindings.Type;

/** Whether owner configuration succeeded, conflicted, or referenced a missing installation. */
export const SlackBindingResult = Schema.TaggedUnion({
  Configured: { binding: SlackBinding },
  Conflicting: {},
  ConnectionMissing: {},
});

export type SlackBindingResult = typeof SlackBindingResult.Type;

/** Receipt fields shared by the public read model and durable outbox rows. */
export const SLACK_DELIVERY_FIELDS = {
  id: SlackDeliveryId,
  bindingId: SlackBindingId,
  /** Absent until a binding notification freezes its audience. */
  destination: Schema.OptionFromNullOr(SlackDestination),
  status: Schema.Enum(SlackDeliveryStatus),
  createdAt: Schema.DateTimeUtcFromMillis,
  /** Absent after settlement or when automated recovery has stopped. */
  nextAttemptAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  /** Absent until a provider response or history confirms the write. */
  messageTimestamp: Schema.OptionFromNullOr(Schema.NonEmptyString),
  /** Absent when no delivery failure is recorded. */
  lastError: Schema.OptionFromNullOr(Schema.NonEmptyString),
} as const;

/** An inspectable delivery outcome without its message body or credentials. */
export const SlackDelivery = wireStruct({ fields: SLACK_DELIVERY_FIELDS });
export type SlackDelivery = typeof SlackDelivery.Type;

/** The latest delivery receipts for one agent. */
export const SlackDeliveries = Schema.Struct({ deliveries: Schema.Array(SlackDelivery) });
export type SlackDeliveries = typeof SlackDeliveries.Type;
