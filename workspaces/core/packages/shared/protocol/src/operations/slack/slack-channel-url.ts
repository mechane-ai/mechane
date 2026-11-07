import type { SlackChannelId, SlackTeamId } from '@mechane/records';

type SlackChannelUrlInput = { readonly teamId: SlackTeamId; readonly channelId: SlackChannelId };

/** Builds a Slack client link from verified identities without resolving or authorizing the destination. */
export function slackChannelUrl({ teamId, channelId }: SlackChannelUrlInput): string {
  return `https://app.slack.com/client/${encodeURIComponent(teamId)}/${encodeURIComponent(channelId)}`;
}
