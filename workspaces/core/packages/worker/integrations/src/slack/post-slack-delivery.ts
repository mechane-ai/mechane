import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import type { SlackDeliveryId, SlackDestination } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result } from 'effect';
import { SLACK_METADATA_TYPE, SLACK_REQUEST_TIMEOUT, SlackApiMethod } from './constants.ts';
import { readSlackPostResult } from './read-slack-post-result.ts';
import type { SlackPostResult } from './schemas.ts';
import { slackApiUrl } from './slack-api-url.ts';
import { slackAuthorization } from './slack-authorization.ts';
import type { SlackClientInput } from './types.ts';

type PostSlackDeliveryInput = SlackClientInput & {
  readonly deliveryId: SlackDeliveryId;
  readonly destination: SlackDestination;
  readonly text: string;
  readonly contentSha256: string;
};

type SlackPostBodyInput = Pick<PostSlackDeliveryInput, 'deliveryId' | 'destination' | 'text' | 'contentSha256'>;

/** Posts one claimed delivery without forwarding credentials through redirects. */
export async function postSlackDelivery({
  installation,
  token,
  ...message
}: PostSlackDeliveryInput): Promise<SlackPostResult> {
  const url = slackApiUrl({ origin: installation.apiOrigin, method: SlackApiMethod.PostMessage });
  const body = slackPostBody(message);

  const headers = {
    [HttpHeader.Authorization]: slackAuthorization({ token }),
    [HttpHeader.ContentType]: MediaType.Json,
  };

  const timeout = Duration.toMillis(SLACK_REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const promise = fetch(url, { method: HttpMethod.Post, headers, body, signal, redirect: 'manual' });
  const settled = await capturePromise({ promise });
  const response = Result.getSuccess(settled);

  return await readSlackPostResult({ response, channelId: message.destination.channelId });
}

function slackPostBody({ deliveryId, destination, text, contentSha256 }: SlackPostBodyInput): string {
  const threadTimestamp = Option.getOrUndefined(destination.threadTimestamp);

  return JSON.stringify({
    channel: destination.channelId,
    thread_ts: threadTimestamp,
    text,
    client_msg_id: deliveryId,
    reply_broadcast: false,
    unfurl_links: false,
    unfurl_media: false,
    metadata: {
      event_type: SLACK_METADATA_TYPE,
      event_payload: { delivery_id: deliveryId, content_sha256: contentSha256 },
    },
  });
}
