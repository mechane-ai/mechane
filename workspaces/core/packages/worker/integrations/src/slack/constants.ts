import { Duration } from 'effect';

/** The maximum time one Slack HTTP request holds the agent alarm. */
export const SLACK_REQUEST_TIMEOUT = Duration.seconds(10);
/** The reply bound below Slack message truncation, applied before hashing and posting. */
export const SLACK_REPLY_MAX_CHARS = 39_000;
/** The metadata namespace used to reconcile uncertain Mechane deliveries. */
export const SLACK_METADATA_TYPE = 'mechane_delivery';

/** The Slack methods used for posting and delivery reconciliation. */
export const SlackApiMethod = {
  PostMessage: 'chat.postMessage',
  Replies: 'conversations.replies',
  History: 'conversations.history',
} as const;

export type SlackApiMethod = (typeof SlackApiMethod)[keyof typeof SlackApiMethod];

/** The signed envelope types this connector accepts. */
export const SlackEnvelopeType = { EventCallback: 'event_callback', UrlVerification: 'url_verification' } as const;

/** The human event types that can enter an agent inbox. */
export const SlackMessageType = { Message: 'message', Mention: 'app_mention' } as const;
