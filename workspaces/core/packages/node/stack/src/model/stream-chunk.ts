import type { ReplyId } from './types.ts';

/** One chunk of a streamed reply: the reply's id and offer, and the chunk's own fields. */
type StreamChunkInput = {
  readonly id: ReplyId;
  readonly model: string;
  readonly fields: Readonly<Record<string, unknown>>;
};

/** One event of a chat-completions stream, carrying a chunk of the reply. */
export function streamChunk({ id, model, fields }: StreamChunkInput): string {
  return `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 0, model, ...fields })}\n\n`;
}
