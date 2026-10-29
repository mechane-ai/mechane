import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Duration } from 'effect';
import { setTimeout } from 'node:timers/promises';
import { ChatRole } from './constants.ts';
import { streamChunk } from './stream-chunk.ts';
import type { ModelAnswer, ReplyId, ScriptedReply } from './types.ts';

/** The bytes the scripted upstream counts as one token, of a request's body and of its reply. */
const BYTES_PER_TOKEN = 4;

/** The line that ends a chat-completions event stream. */
const STREAM_END = 'data: [DONE]\n\n';

type StreamAnswerInput = {
  readonly model: string;
  readonly reply: ScriptedReply;
  readonly body: string;
  readonly sessionId: string;
  readonly user: string;
};

/** A reply's stream: its first chunk, the rest, and how long it stays open between them. */
type HeldBodyInput = { readonly head: string; readonly tail: string; readonly hold: Duration.Duration };

/**
 * The reply as a chat-completions event stream: its delta, then, after the reply's hold, its end and its usage. The
 * usage counts a token for each `BYTES_PER_TOKEN` bytes of the request's body and of the reply's completion, rounded
 * up.
 */
export function streamAnswer({ model, reply, body: requestBody, sessionId, user }: StreamAnswerInput): ModelAnswer {
  const id: ReplyId = `scripted-${crypto.randomUUID()}`;
  const promptTokens = Math.ceil(Buffer.byteLength(requestBody) / BYTES_PER_TOKEN);
  const completionTokens = Math.ceil(Buffer.byteLength(reply.completion) / BYTES_PER_TOKEN);

  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };

  const head = streamChunk({
    id,
    model,
    fields: { choices: [{ index: 0, delta: { role: ChatRole.Assistant, ...reply.delta } }] },
  });

  const tail = [
    streamChunk({ id, model, fields: { choices: [{ index: 0, delta: {}, finish_reason: reply.finishReason }] } }),
    streamChunk({ id, model, fields: { choices: [], usage } }),
    STREAM_END,
  ].join('');

  return {
    status: HttpStatusCode.Ok,
    headers: { [HttpHeader.ContentType]: MediaType.EventStream },
    body: heldBody({ head, tail, hold: reply.hold }),
    answered: [{ model, promptTokens, completionTokens, body: requestBody, sessionId, user }],
  };
}

/**
 * A stream's body that writes its first chunk, holds the stream open, then writes the rest.
 *
 * @yields The first chunk, then, once the hold has passed, the rest
 */
async function* heldBody({ head, tail, hold }: HeldBodyInput): AsyncGenerator<string> {
  yield head;

  await setTimeout(Duration.toMillis(hold));

  yield tail;
}
