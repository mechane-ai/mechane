import { createSlackAdapter } from '@chat-adapter/slack';
import { SlackWebhookVerificationError, verifySlackRequest } from '@chat-adapter/slack/webhook';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Chat } from 'chat';
import type { Message, Thread } from 'chat';
import { Redacted } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import { loadRuntimeConfiguration } from '../config.ts';
import type { SlackOrigin } from '../domain.ts';
import { openChatState } from '../store/channels/chat-state.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { deliverSlackDelivery } from './deliver-slack-delivery.ts';
import { channelRecordId } from './identity.ts';
import { readBoundedBytes } from './read-bounded-bytes.ts';
import { slackApiUrl } from './slack-api-url.ts';
import { SlackChallenge, SlackEventEnvelope, SlackMessageEvent } from './slack-event.ts';
import { slackLogger } from './slack-logger.ts';

const WEBHOOK_MAX_BYTES = 1_048_576;
const SESSION_TITLE_MAX_CHARS = 160;
const SLACK_TIMEOUT_MILLISECONDS = 15_000;
const ALL_MESSAGES = /[\s\S]*/u;

const ADMISSION_REFUSAL =
  'This mech is not accepting messages right now. Ask its owner to enable it, then send your request again.';

type ReceiveSlackInput = {
  readonly request: Request;
  readonly installationId: string;
  readonly workspaceId: string;
  readonly startAdmission: (input: { readonly runId: string }) => Promise<unknown>;
};

export async function receiveSlack({
  request,
  installationId,
  workspaceId,
  startAdmission,
}: ReceiveSlackInput): Promise<Response> {
  return await withRuntimeStore(async (store) => {
    const installation = await store.getSlackInstallation({ installationId, workspaceId });

    if (installation === null) {
      return new Response('Unknown Slack installation', { status: HttpStatusCode.NotFound });
    }

    const secret = await store.getCredential({
      workspaceId: installation.workspaceId,
      reference: installation.signingSecretReference,
    });

    if (secret === null) {
      return new Response('Slack installation is unavailable', { status: HttpStatusCode.Unavailable });
    }

    const payload = await readVerifiedPayload(request, Redacted.value(secret));

    if (payload instanceof Response) {
      return payload;
    }

    const challenge = SlackChallenge.safeParse(payload);

    if (challenge.success) {
      return Response.json({ challenge: challenge.data.challenge });
    }

    const envelope = SlackEventEnvelope.safeParse(payload);

    if (!envelope.success) {
      return new Response('ok');
    }

    if (envelope.data.team_id !== installation.teamId) {
      return new Response('Slack workspace does not match', { status: HttpStatusCode.Forbidden });
    }

    const event = SlackMessageEvent.safeParse(envelope.data.event);

    if (!event.success) {
      return new Response('ok');
    }

    const message = event.data;

    if (message.bot_id !== undefined || message.subtype !== undefined || message.user === undefined) {
      return new Response('ok');
    }

    const verifiedUserId = message.user;
    const binding = await store.findSlackBinding({ installationId, channelId: message.channel });

    if (binding === null || !binding.isListening) {
      return new Response('ok');
    }

    if (binding.allowedUserIds !== null && !binding.allowedUserIds.includes(message.user)) {
      return new Response('ok');
    }

    const configuration = loadRuntimeConfiguration();
    const logger = slackLogger();

    const chatState = openChatState({
      databaseUrl: configuration.databaseUrl,
      installationId: installation.id,
      logger,
    });

    const adapter = createSlackAdapter({
      botUserId: installation.botUserId,
      userName: 'Factory',
      apiUrl: slackApiUrl(installation.apiOrigin),
      signingSecret: Redacted.value(secret),
      logger,
      botToken: async () => {
        const token = await store.getCredential({
          workspaceId: installation.workspaceId,
          reference: installation.botTokenReference,
        });

        if (token === null) {
          throw new Error('Slack bot credential is unavailable');
        }

        return Redacted.value(token);
      },
      webClientOptions: {
        retryConfig: { retries: 0 },
        rejectRateLimitedCalls: true,
        timeout: SLACK_TIMEOUT_MILLISECONDS,
      },
    });

    const chat = new Chat({
      userName: 'Factory',
      adapters: { slack: adapter },
      state: chatState.state,
      logger,
      concurrency: { strategy: 'concurrent' },
    });

    const route = { binding, installation };

    async function admit(_thread: Thread, normalized: Message): Promise<void> {
      const threadId = message.thread_ts ?? message.ts;

      const session = await store.ensureSession({
        workspaceId: route.binding.workspaceId,
        mechId: route.binding.mechId,
        key: `slack:${route.installation.id}:${route.binding.id}:${threadId}`,
        source: 'slack',
        title: normalized.text.slice(0, SESSION_TITLE_MAX_CHARS),
      });

      const inputId = channelRecordId(`slack:${route.installation.id}:${message.channel}:${message.ts}`);
      const inputText = normalized.text;

      const attachments = (message.files ?? []).map((file) => ({
        id: file.id,
        name: file.name ?? file.id,
        mediaType: file.mimetype ?? null,
        sizeBytes: file.size ?? null,
        url: file.url_private ?? null,
      }));

      const origin: SlackOrigin = {
        kind: 'slack',
        installationId: route.installation.id,
        bindingId: route.binding.id,
        teamId: route.installation.teamId,
        channelId: message.channel,
        threadId,
        messageId: message.ts,
        userId: verifiedUserId,
      };

      const refusalContent = { text: ADMISSION_REFUSAL };

      const result = await store.admitSlackInput({
        refusal: {
          id: channelRecordId(`slack-refusal:${inputId}`),
          content: refusalContent,
          contentDigest: createHash('sha256').update(JSON.stringify(refusalContent)).digest('hex'),
        },
        input: {
          id: inputId,
          runId: randomUUID(),
          workspaceId: route.binding.workspaceId,
          mechId: route.binding.mechId,
          sessionId: session.id,
          idempotencyKey: `slack:${route.installation.id}:${message.channel}:${message.ts}`,
          inputText,
          inputMessage: { id: inputId, role: 'user', parts: [{ type: 'text', text: inputText }] },
          attachments,
          origin,
        },
      });

      if (result.status === 'refused') {
        await deliverSlackDelivery({ store, delivery: result.delivery, origin, purpose: 'refusal' });

        return;
      }

      await startAdmission({ runId: result.admission.run.id });
    }

    chat.onNewMessage(ALL_MESSAGES, admit);
    chat.onNewMention(admit);
    chat.onSubscribedMessage(admit);
    chat.onDirectMessage(admit);

    try {
      await chat.initialize();

      const normalized = adapter.parseMessage({
        type: message.type,
        channel: message.channel,
        ts: message.ts,
        thread_ts: message.thread_ts ?? message.ts,
        text: message.text ?? '',
        user: verifiedUserId,
        team_id: installation.teamId,
      });

      await chat.processMessage(adapter, normalized.threadId, normalized, {
        deduplicate: false,
        propagateHandlerErrors: true,
      });

      return new Response('ok');
    } finally {
      try {
        await chat.shutdown();
      } finally {
        await chatState.close();
      }
    }
  });
}

async function boundedRequestText(request: Request): Promise<string> {
  if (request.body === null) {
    throw new Error('Slack request has no body');
  }

  const bytes = await readBoundedBytes({ body: request.body, maximumBytes: WEBHOOK_MAX_BYTES });

  return bytes.toString('utf8');
}

async function readVerifiedPayload(request: Request, signingSecret: string): Promise<unknown> {
  try {
    const raw = await boundedRequestText(request);
    const verifiedRequest = new Request(request.url, { method: HttpMethod.Post, headers: request.headers, body: raw });

    await verifySlackRequest(verifiedRequest, { signingSecret });

    if (request.headers.get(HttpHeader.ContentType)?.includes(MediaType.FormUrlEncoded) === true) {
      return new Response('ok');
    }

    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SlackWebhookVerificationError) {
      return new Response('Invalid Slack signature', { status: HttpStatusCode.Unauthorized });
    }

    if (error instanceof SyntaxError) {
      return new Response('Invalid Slack payload', { status: HttpStatusCode.BadRequest });
    }

    if (error instanceof RangeError) {
      return new Response('Slack payload is too large', { status: HttpStatusCode.PayloadTooLarge });
    }

    throw error;
  }
}
