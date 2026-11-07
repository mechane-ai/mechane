import { callSlackApi, SlackApiError } from '@chat-adapter/slack/api';
import { HttpStatusCode } from '@mechane/records';
import { Redacted } from 'effect';
import { FatalError, RetryableError } from 'workflow';
import { z } from 'zod';
import type { SlackDelivery, SlackInstallation, SlackOrigin } from '../domain.ts';
import type { RuntimeStore } from '../store/database.ts';
import { DeliveryContent, slackDeliveryPayload } from './delivery-content.ts';
import { boundedSlackFetch, reconcileSlackDelivery, SLACK_DELIVERY_METADATA } from './reconcile-delivery.ts';
import { slackApiUrl } from './slack-api-url.ts';

type DeliverSlackDeliveryInput = {
  readonly store: RuntimeStore;
  readonly delivery: SlackDelivery;
  readonly origin: SlackOrigin;
  readonly purpose: 'output' | 'refusal';
};

export type DeliveryResult =
  | { readonly status: 'delivered'; readonly messageId: string }
  | { readonly status: 'blocked' | 'not-slack' };

const PostedMessage = z.object({ ok: z.literal(true), ts: z.string().min(1) });
const ACKNOWLEDGEMENT_REACTION = 'eyes';

export async function deliverSlackDelivery({
  store,
  delivery,
  origin,
  purpose,
}: DeliverSlackDeliveryInput): Promise<DeliveryResult> {
  const deliveryId = delivery.id;

  const installation = await store.getSlackInstallation({
    installationId: origin.installationId,
    workspaceId: delivery.workspaceId,
  });

  if (delivery.status === 'delivered') {
    if (delivery.messageId === null) {
      throw new FatalError('The completed Slack delivery has no message identity');
    }

    return { status: 'delivered', messageId: delivery.messageId };
  }

  const isAllowed = await store.isSlackDeliveryAllowed({
    workspaceId: delivery.workspaceId,
    mechId: delivery.mechId,
    origin,
    purpose,
  });

  if (!isAllowed || installation === null) {
    await store.failSlackDelivery({
      deliveryId,
      status: 'blocked',
      reason: 'The Slack destination is no longer available to this requester',
    });

    return { status: 'blocked' };
  }

  const credential = await store.getCredential({
    workspaceId: delivery.workspaceId,
    reference: installation.botTokenReference,
  });

  if (credential === null) {
    throw new FatalError('Slack bot credential is unavailable');
  }

  const token = Redacted.value(credential);

  if (delivery.kind === 'acknowledgement') {
    const result = await acknowledgeSlackInput({ installation, origin, token });

    if (result === 'reacted') {
      await store.completeSlackDelivery({ deliveryId, messageId: origin.messageId });

      return { status: 'delivered', messageId: origin.messageId };
    }
  }

  switch (delivery.status) {
    case 'sending':
    case 'uncertain': {
      const historyReference = installation.historyTokenReference ?? installation.botTokenReference;

      const historyCredential = await store.getCredential({
        workspaceId: delivery.workspaceId,
        reference: historyReference,
      });

      if (historyCredential === null) {
        throw new FatalError('Slack delivery history credential is unavailable');
      }

      const messageId = await reconcileSlackDelivery({
        delivery,
        installation,
        token: Redacted.value(historyCredential),
      });

      if (messageId !== null) {
        await store.completeSlackDelivery({ deliveryId, messageId });

        return { status: 'delivered', messageId };
      }

      await store.failSlackDelivery({
        deliveryId,
        status: 'uncertain',
        reason: 'Slack has not confirmed the prior message delivery',
      });

      throw new RetryableError('Slack message delivery is awaiting reconciliation', { retryAfter: '30s' });
    }

    case 'failed':
    case 'blocked':
      return { status: 'blocked' };
    case 'pending':
      break;
  }

  const claimed = await store.claimSlackDelivery({ deliveryId });

  if (!claimed) {
    throw new RetryableError('Slack delivery is already being completed', { retryAfter: '5s' });
  }

  try {
    const payload = slackDeliveryPayload(DeliveryContent.parse(delivery.content));

    const response = await callSlackApi(
      'chat.postMessage',
      {
        ...payload,
        channel: delivery.channelId,
        thread_ts: delivery.threadId,
        client_msg_id: delivery.id,
        metadata: {
          event_type: SLACK_DELIVERY_METADATA,
          event_payload: { delivery_id: delivery.id, content_sha256: delivery.contentDigest },
        },
        unfurl_links: false,
        unfurl_media: false,
      },
      { token, apiUrl: slackApiUrl(installation.apiOrigin), fetch: boundedSlackFetch, contentType: 'json' },
    );

    const messageId = PostedMessage.parse(response).ts;

    await store.completeSlackDelivery({ deliveryId, messageId });

    return { status: 'delivered', messageId };
  } catch (error) {
    const classification = classifySlackFailure(error);

    await store.failSlackDelivery({ deliveryId, status: classification.status, reason: classification.message });

    if (classification.status === 'failed') {
      throw new FatalError(classification.message);
    }

    throw new RetryableError(classification.message, { retryAfter: '30s' });
  }
}

type AcknowledgeInput = {
  readonly installation: SlackInstallation;
  readonly origin: SlackOrigin;
  readonly token: string;
};

async function acknowledgeSlackInput({ installation, origin, token }: AcknowledgeInput): Promise<'reacted' | 'text'> {
  try {
    await callSlackApi(
      'reactions.add',
      { channel: origin.channelId, timestamp: origin.messageId, name: ACKNOWLEDGEMENT_REACTION },
      { token, apiUrl: slackApiUrl(installation.apiOrigin), fetch: boundedSlackFetch, contentType: 'json' },
    );

    return 'reacted';
  } catch (error) {
    if (error instanceof SlackApiError) {
      const reason = error.response?.error ?? '';

      switch (reason) {
        case 'already_reacted':
          return 'reacted';
        case 'missing_scope':
        case 'not_allowed_token_type':
          return 'text';
        default:
          break;
      }
    }

    throw new RetryableError('Slack acknowledgement could not be confirmed', { retryAfter: '15s' });
  }
}

type SlackFailure = { readonly status: 'pending' | 'uncertain' | 'failed'; readonly message: string };

function classifySlackFailure(error: unknown): SlackFailure {
  if (error instanceof SlackApiError) {
    if (error.status === HttpStatusCode.TooManyRequests || error.response?.error === 'ratelimited') {
      return { status: 'pending', message: 'Slack requested a slower delivery rate' };
    }

    if (error.status !== undefined && error.status >= HttpStatusCode.InternalServerError) {
      return { status: 'uncertain', message: 'Slack did not confirm whether the message was posted' };
    }

    if (error.response?.ok === false) {
      return { status: 'failed', message: 'Slack rejected the message delivery' };
    }
  }

  return { status: 'uncertain', message: 'Slack did not confirm whether the message was posted' };
}
