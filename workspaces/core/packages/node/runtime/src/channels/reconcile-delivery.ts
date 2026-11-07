import { fetchSlackThreadReplies } from '@chat-adapter/slack/api';
import { z } from 'zod';
import type { SlackDelivery, SlackInstallation } from '../domain.ts';
import { slackApiUrl } from './slack-api-url.ts';

const HISTORY_MAX_PAGES = 20;
const HISTORY_PAGE_MAX_ITEMS = 100;
export const SLACK_DELIVERY_METADATA = 'mechane_delivery';

const RecordedMessage = z.object({
  ts: z.string(),
  user: z.string(),
  metadata: z.object({
    event_type: z.literal(SLACK_DELIVERY_METADATA),
    event_payload: z.object({ delivery_id: z.string(), content_sha256: z.string() }),
  }),
});

type ReconcileInput = {
  readonly delivery: SlackDelivery;
  readonly installation: SlackInstallation;
  readonly token: string;
};

export async function reconcileSlackDelivery({
  delivery,
  installation,
  token,
}: ReconcileInput): Promise<string | null> {
  const cursors: Array<string> = [''];

  for (let page = 0; page < HISTORY_MAX_PAGES; page += 1) {
    const result = await fetchSlackThreadReplies({
      token,
      apiUrl: slackApiUrl(installation.apiOrigin),
      channel: delivery.channelId,
      ts: delivery.threadId,
      includeAllMetadata: true,
      limit: HISTORY_PAGE_MAX_ITEMS,
      cursor: cursors[page] ?? '',
      fetch: boundedSlackFetch,
    });

    const messageId = findDeliveredMessage({ messages: result.messages, delivery, botUserId: installation.botUserId });

    if (messageId !== null) {
      return messageId;
    }

    if (result.nextCursor === undefined || result.nextCursor === '') {
      return null;
    }

    cursors.push(result.nextCursor);
  }

  throw new Error('Slack delivery history exceeded the reconciliation limit');
}

type FindDeliveryInput = {
  readonly messages: ReadonlyArray<unknown>;
  readonly delivery: SlackDelivery;
  readonly botUserId: string;
};

function findDeliveredMessage({ messages, delivery, botUserId }: FindDeliveryInput): string | null {
  for (const message of messages) {
    const parsed = RecordedMessage.safeParse(message);

    if (parsed.success) {
      const record = parsed.data;
      const identity = record.metadata.event_payload;

      if (
        record.user === botUserId &&
        identity.delivery_id === delivery.id &&
        identity.content_sha256 === delivery.contentDigest
      ) {
        return record.ts;
      }
    }
  }

  return null;
}

const SLACK_REQUEST_TIMEOUT_MS = 15_000;

export async function boundedSlackFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS);
  const signal = init?.signal;
  const signals = [timeout];

  if (signal !== undefined && signal !== null) {
    signals.push(signal);
  }

  return await fetch(input, { ...init, signal: AbortSignal.any(signals), redirect: 'error' });
}
