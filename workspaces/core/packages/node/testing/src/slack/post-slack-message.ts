import { slackEventsPath } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType, SlackConnectionId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { createHmac, randomUUID } from 'node:crypto';
import type { ConnectedSlack } from './connect-slack.ts';

type PostMessageInput = {
  readonly origin: URL;
  readonly workspaceId: string;
  readonly slack: ConnectedSlack;
  readonly text: string;
  readonly messageTimestamp: string;
  readonly threadTimestamp?: string;
  readonly eventId?: string;
};

const MILLISECONDS_PER_SECOND = 1000;
const CALLBACK_TIMEOUT_MS = 15_000;

export async function postSlackMessage(input: PostMessageInput): Promise<Response> {
  const event = {
    type: 'event_callback',
    event_id: input.eventId ?? randomUUID(),
    team_id: input.slack.teamId,
    event: {
      type: 'message',
      channel: input.slack.channelId,
      channel_type: 'channel',
      user: input.slack.userId,
      text: input.text,
      ts: input.messageTimestamp,
      thread_ts: input.threadTimestamp,
    },
  };

  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / MILLISECONDS_PER_SECOND));
  const signature = createHmac('sha256', input.slack.signingSecret).update(`v0:${timestamp}:${body}`).digest('hex');
  const workspaceId = Schema.decodeUnknownSync(WorkspaceId)(input.workspaceId);
  const connectionId = Schema.decodeUnknownSync(SlackConnectionId)(input.slack.connectionId);
  const path = slackEventsPath({ workspaceId, connectionId });

  return await fetch(new URL(path, input.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.SlackRequestTimestamp]: timestamp,
      [HttpHeader.SlackSignature]: `v0=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
  });
}
