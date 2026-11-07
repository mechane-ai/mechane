import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Record } from 'effect';
import { randomBytes } from 'node:crypto';
import type { SlackCall, SlackFixture, SlackMessage } from '../types.ts';
import { optionalText, record, startHttpService, text } from './http.ts';
import type { HttpService } from './http.ts';

const BOT_TOKEN_BYTES = 24;
const SIGNING_SECRET_BYTES = 32;
const MILLISECONDS_PER_SECOND = 1000;
const TIMESTAMP_SEQUENCE_DIGITS = 6;

export type StartedSlack = { readonly fixture: SlackFixture; readonly close: HttpService['close'] };

export async function startSlackFixture(): Promise<StartedSlack> {
  const botToken = `xoxb-fixture-${randomBytes(BOT_TOKEN_BYTES).toString('hex')}`;
  const signingSecret = randomBytes(SIGNING_SECRET_BYTES).toString('hex');
  const teamId = 'TMECHANEFIXTURE';
  const botUserId = 'UMECHANEBOT';
  const botId = 'BMECHANEBOT';
  const messages: Array<SlackMessage> = [];
  const calls: Array<SlackCall> = [];
  const state = { shouldLoseReceipt: false, sequence: 0 };

  async function handle(request: Request): Promise<Response> {
    if (request.headers.get(HttpHeader.Authorization) !== `Bearer ${botToken}`) {
      return Response.json({ ok: false, error: 'invalid_auth' });
    }

    const url = new URL(request.url);
    const method = url.pathname.replace(/^\/api\//u, '');
    const body = await readSlackBody(request);

    calls.push({ method, body });

    switch (method) {
      case 'auth.test':
        return Response.json({ ok: true, team: 'Mechane fixture', team_id: teamId, user_id: botUserId, bot_id: botId });
      case 'chat.postMessage': {
        const previous = messages.find(
          (message) => body['client_msg_id'] !== undefined && message.client_msg_id === body['client_msg_id'],
        );

        if (previous !== undefined) {
          return Response.json({ ok: true, channel: previous.channel, ts: previous.ts, message: previous });
        }

        state.sequence += 1;
        const ts = `${Math.floor(Date.now() / MILLISECONDS_PER_SECOND)}.${String(state.sequence).padStart(TIMESTAMP_SEQUENCE_DIGITS, '0')}`;

        const message: SlackMessage = {
          channel: text(body['channel']),
          ts,
          thread_ts: optionalText(body['thread_ts']) ?? ts,
          text: optionalText(body['text']) ?? '',
          markdown_text: optionalText(body['markdown_text']),
          user: botUserId,
          bot_id: botId,
          blocks: body['blocks'],
          metadata: body['metadata'],
          client_msg_id: optionalText(body['client_msg_id']),
        };

        messages.push(message);

        if (state.shouldLoseReceipt) {
          state.shouldLoseReceipt = false;

          return Response.json({ ok: false, error: 'internal_error' }, { status: HttpStatusCode.Unavailable });
        }

        return Response.json({ ok: true, channel: message.channel, ts, message });
      }
      case 'chat.update': {
        const index = messages.findIndex((message) => message.channel === body['channel'] && message.ts === body['ts']);
        const previous = messages[index];

        if (previous === undefined) {
          return Response.json({ ok: false, error: 'message_not_found' });
        }

        const message = {
          ...previous,
          text: optionalText(body['text']) ?? previous.text,
          markdown_text: optionalText(body['markdown_text']) ?? previous.markdown_text,
          blocks: body['blocks'] ?? previous.blocks,
          metadata: body['metadata'] ?? previous.metadata,
        };

        messages[index] = message;

        return Response.json({ ok: true, channel: message.channel, ts: message.ts, message });
      }
      case 'conversations.replies':
      case 'conversations.history': {
        const found = messages.filter(
          (message) =>
            message.channel === body['channel'] && (body['ts'] === undefined || message.thread_ts === body['ts']),
        );

        const includeMetadata = body['include_all_metadata'] === true || body['include_all_metadata'] === 'true';

        const visible = found.map((message) => {
          if (includeMetadata) {
            return message;
          }

          const { metadata: _metadata, ...withoutMetadata } = message;

          return withoutMetadata;
        });

        return Response.json({ ok: true, messages: visible, has_more: false, response_metadata: { next_cursor: '' } });
      }
      case 'conversations.info':
        return Response.json({
          ok: true,
          channel: { id: body['channel'], name: 'mechane-fixture', is_im: false, is_private: true },
        });
      case 'users.info':
        return Response.json({
          ok: true,
          user: {
            id: body['user'],
            team_id: teamId,
            name: 'fixture-user',
            real_name: 'Fixture User',
            is_bot: body['user'] === botUserId,
            profile: { display_name: 'Fixture User' },
          },
        });
      case 'reactions.add':
      case 'reactions.remove':
      case 'assistant.threads.setStatus':
      case 'assistant.threads.setSuggestedPrompts':
        return Response.json({ ok: true });
      default:
        return Response.json({ ok: false, error: 'unknown_method' });
    }
  }

  const service = await startHttpService(handle);

  return {
    fixture: {
      origin: service.origin,
      botToken,
      signingSecret,
      teamId,
      botUserId,
      readCalls: () => structuredClone(calls),
      readMessages: () => structuredClone(messages),
      loseNextPostReceipt: () => {
        state.shouldLoseReceipt = true;
      },
    },
    close: service.close,
  };
}

async function readSlackBody(request: Request): Promise<Readonly<Record<string, unknown>>> {
  if (request.method === HttpMethod.Get) {
    return Record.fromEntries(new URL(request.url).searchParams);
  }

  if (request.headers.get(HttpHeader.ContentType)?.includes(MediaType.Json) === true) {
    return record(await request.json());
  }

  return Record.fromEntries(new URLSearchParams(await request.text()));
}
