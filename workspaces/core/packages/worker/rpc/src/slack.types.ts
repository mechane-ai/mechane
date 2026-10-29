import type { SlackBinding } from '@mechane/protocol';
import type {
  InboxItemId,
  SlackBindingId,
  SlackChannelId,
  SlackConnectionId,
  SlackEventId,
  SlackInboxOrigin,
  SlackTeamId,
} from '@mechane/records';

export type ConfigureSlackBindingInput = { readonly binding: typeof SlackBinding.Encoded };
export type SlackBindingInput = { readonly bindingId: SlackBindingId };

export type AdmitSlackEventInput = {
  readonly connectionId: SlackConnectionId;
  readonly eventId: SlackEventId;
  readonly teamId: SlackTeamId;
  readonly channelId: SlackChannelId;
  readonly messageTimestamp: string;
  readonly fingerprint: string;
};

export type ReceiveSlackInboxItemInput = {
  readonly inboxItemId: InboxItemId;
  readonly text: string;
  readonly origin: typeof SlackInboxOrigin.Encoded;
};
