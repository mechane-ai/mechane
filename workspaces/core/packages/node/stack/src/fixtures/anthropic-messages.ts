import { HttpHeader, MediaType } from '@mechane/records';
import { randomUUID } from 'node:crypto';
import type { ModelReply } from '../types.ts';

type NativeReply = {
  readonly model: string;
  readonly reply: ModelReply & { readonly promptTokens: number };
  readonly speed: unknown;
  readonly outputTokens: number;
};

export function anthropicMessageResponse({ model, reply, speed, outputTokens }: NativeReply): Response {
  const message = {
    id: `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    model,
    content: [],
    stop_reason: null,
    usage: {
      input_tokens: reply.promptTokens,
      output_tokens: 0,
      speed,
      cache_creation_input_tokens:
        (reply.cacheCreation?.ephemeral_5m_input_tokens ?? 0) + (reply.cacheCreation?.ephemeral_1h_input_tokens ?? 0),
      cache_creation: reply.cacheCreation,
    },
  };

  const events = [
    { type: 'message_start', message },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: reply.text ?? '' } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: outputTokens },
    },
    { type: 'message_stop' },
  ];

  const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(body, { headers: { [HttpHeader.ContentType]: MediaType.EventStream } });
}
