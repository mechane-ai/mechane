import type { NotificationBody } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { createHmac } from 'node:crypto';

type ProducerDelivery = {
  readonly origin: URL;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly notificationId: string;
  readonly producerId: string;
  readonly signingSecret: string;
  readonly body: NotificationBody;
  readonly timestamp?: string;
  readonly signedPath?: string;
};

const NOTIFICATION_TIMEOUT_MS = 15_000;
const MILLISECONDS_PER_SECOND = 1000;

export async function deliverNotification(input: ProducerDelivery): Promise<Response> {
  const pathname = notificationPath(input);
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / MILLISECONDS_PER_SECOND));
  const rawBody = JSON.stringify(input.body);

  const signature = createHmac('sha256', input.signingSecret)
    .update(`${timestamp}.${input.signedPath ?? pathname}.${rawBody}`)
    .digest('hex');

  return await fetch(new URL(pathname, input.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.NotificationProducer]: input.producerId,
      [HttpHeader.NotificationTimestamp]: timestamp,
      [HttpHeader.NotificationSignature]: signature,
    },
    body: rawBody,
    signal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS),
  });
}

type NotificationAddress = Pick<ProducerDelivery, 'workspaceId' | 'mechId' | 'notificationId'>;

export function notificationPath(input: NotificationAddress): string {
  return `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/mechs/${encodeURIComponent(input.mechId)}/notifications/${encodeURIComponent(input.notificationId)}`;
}
