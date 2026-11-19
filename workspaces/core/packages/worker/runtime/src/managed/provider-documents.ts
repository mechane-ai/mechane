import type { ImageContent, Message, StreamOptions, TextContent, TranscriptContext } from '@earendil-works/pi-ai';
import { Schema } from 'effect';
import type { ModelOffer } from '../config.ts';
import { insertFiles } from './document-payload.ts';
import { pdfBytes } from './pdf-attachment.ts';

type Content = TextContent | ImageContent;
type PayloadHook = NonNullable<StreamOptions['onPayload']>;
type AttachmentRequest = { readonly transcript: TranscriptContext; readonly onPayload: PayloadHook | undefined };
type RegisterDocument = (encodedDocument: string) => TextContent;

export class UnsupportedManagedImages extends Schema.TaggedError<UnsupportedManagedImages>()(
  'UnsupportedManagedImages',
  {},
) {}

function userDocuments(message: Message, register: RegisterDocument): Message {
  if (message.role !== 'user' || typeof message.content === 'string') {
    return message;
  }

  const content = message.content.map((part) => {
    const encodedDocument = pdfBytes(part);

    if (encodedDocument === undefined) {
      return part;
    }

    return register(encodedDocument);
  });

  return { ...message, content };
}

function containsPart(message: Message, predicate: (part: Content) => boolean): boolean {
  switch (message.role) {
    case 'toolResult':
    case 'user':
      return typeof message.content !== 'string' && message.content.some(predicate);
    case 'assistant':
    case 'system':
      return false;
  }
}

export function prepareManagedDocuments(
  transcript: TranscriptContext,
  previous: PayloadHook | undefined,
  offer: Pick<ModelOffer, 'supportsImages' | 'protocol'>,
): AttachmentRequest {
  const protocol = offer.protocol ?? 'openai-completions';

  if (
    offer.supportsImages !== true &&
    transcript.messages.some((message) => containsPart(message, (part) => part.type === 'image'))
  ) {
    throw new UnsupportedManagedImages();
  }

  if (!transcript.messages.some((message) => containsPart(message, (part) => pdfBytes(part) !== undefined))) {
    return { transcript, onPayload: previous };
  }

  const files = new Map<string, string>();
  const toolResults = new Map<string, ReadonlyArray<Content>>();
  const messages: Array<Message> = [];
  const pending: Array<Content> = [];

  function register(encodedDocument: string): TextContent {
    const id = crypto.randomUUID();

    files.set(id, encodedDocument);

    return { type: 'text', text: id };
  }

  // Chat Completions accepts file parts in user messages. Place tool documents after the contiguous tool results.
  function appendPending(timestamp: number): void {
    if (pending.length > 0) {
      const content = pending.splice(0);

      messages.push({ role: 'user', content, timestamp });
    }
  }

  function appendMessage(message: Message) {
    if (message.role !== 'toolResult') {
      appendPending(message.timestamp);
      messages.push(userDocuments(message, register));

      return;
    }

    if (
      protocol === 'anthropic-messages' &&
      !message.isError &&
      message.content.some((part) => pdfBytes(part) !== undefined)
    ) {
      // Pi joins text tool output into one string. One reference preserves the order of every native block.
      const id = crypto.randomUUID();

      toolResults.set(id, message.content);
      messages.push({ ...message, content: [{ type: 'text', text: id }] });

      return;
    }

    const content = message.content.map((part) => {
      const encodedDocument = pdfBytes(part);

      if (encodedDocument === undefined) {
        return part;
      }

      const label = `PDF from tool result ${message.toolCallId}`;

      pending.push({ type: 'text', text: label }, register(encodedDocument));

      return { type: 'text' as const, text: label };
    });

    messages.push({ ...message, content });
  }

  for (const message of transcript.messages) {
    appendMessage(message);
  }

  appendPending(transcript.messages.at(-1)?.timestamp ?? 0);

  const onPayload: PayloadHook = async (payload, model) => {
    const adjusted = await previous?.(payload, model);

    return insertFiles(adjusted ?? payload, { protocol, files, toolResults });
  };

  return { transcript: { ...transcript, messages }, onPayload };
}
