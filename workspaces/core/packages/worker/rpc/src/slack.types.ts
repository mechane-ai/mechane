import type { SlackBinding, SlackInstallation } from '@mechane/protocol';
import type {
  InboxItemId,
  SlackBindingId,
  SlackChannelId,
  SlackConnectionId,
  SlackDestination,
  SlackEventId,
  SlackInboxOrigin,
  SlackTeamId,
  SlackUserId,
} from '@mechane/records';

export type ConfigureSlackBindingInput = { readonly binding: typeof SlackBinding.Encoded };
export type SlackBindingInput = { readonly bindingId: SlackBindingId };

export type SlackInstallationInput = { readonly connectionId: SlackConnectionId };

export type ConfigureSlackInstallationInput = {
  readonly installation: typeof SlackInstallation.Encoded;
  readonly isCreateOnly: boolean;
};

export type AdmitSlackEventInput = {
  readonly connectionId: SlackConnectionId;
  readonly eventId: SlackEventId;
  readonly teamId: SlackTeamId;
  readonly channelId: SlackChannelId;
  readonly messageTimestamp: string;
  readonly fingerprint: string;
  readonly userId: SlackUserId;
};

export type ReceiveSlackInboxItemInput = {
  readonly inboxItemId: InboxItemId;
  readonly text: string;
  readonly origin: typeof SlackInboxOrigin.Encoded;
};

export type ReceiveSlackNoticeInput = {
  readonly noticeKey: string;
  readonly text: string;
  readonly destination: typeof SlackDestination.Encoded;
};
