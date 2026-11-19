import type { Message, TextContent } from '@earendil-works/pi-ai';
import { Schema } from 'effect';
import type { ManagedEvent } from './protocol.ts';
import { managedInputContent, managedResultContent } from './tool-content.ts';

type InputRole = 'user' | 'toolResult' | 'system';
type Reference = { readonly eventId: string; readonly token: string; readonly role: InputRole };

const Reference = Schema.Struct({
  eventId: Schema.String,
  token: Schema.String,
  role: Schema.Literals(['user', 'toolResult', 'system']),
});

const isReference = Schema.is(Reference);

const textBlocks = Schema.decodeUnknownSync(
  Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String })),
);

const toolResultTypes: ReadonlySet<string> = new Set([
  'user.tool_result',
  'user.custom_tool_result',
  'agent.mcp_tool_result',
  'agent.tool_result',
]);

const inlineBytes = 262_144;
const toolInlineBytes = 32_768;
const toolInlineLines = 1000;

function exceedsInline(content: unknown, maxBytes: number): boolean {
  const raw = JSON.stringify(content ?? []);

  return raw.length > maxBytes || new TextEncoder().encode(raw).byteLength > maxBytes;
}

function privateReference(event: ManagedEvent, role: InputRole): TextContent & { readonly managedContent: Reference } {
  const token = `[[managed-content/${crypto.randomUUID()}]]`;

  return { type: 'text', text: token, managedContent: { token, eventId: event.id, role } };
}

export function nativeInputContent(event: ManagedEvent, isLarge = false) {
  if (isLarge || exceedsInline(event['content'], inlineBytes)) {
    return [privateReference(event, 'user')];
  }

  return managedInputContent(event);
}

export function nativeSystemContent(event: ManagedEvent, isLarge = false) {
  if (isLarge || exceedsInline(event['content'], inlineBytes)) {
    return [privateReference(event, 'system')];
  }

  return [...textBlocks(event['content'])];
}

export function nativeResultContent(event: ManagedEvent, isLarge = false) {
  if (isLarge || exceedsInline(event['content'], toolInlineBytes)) {
    return { output: [privateReference(event, 'toolResult')], isError: event['is_error'] === true };
  }

  const result = managedResultContent(event);
  const texts = result.output?.filter((part) => part.type === 'text').map((part) => part.text) ?? [];

  if (texts.join('').split('\n', toolInlineLines + 1).length > toolInlineLines) {
    return { output: [privateReference(event, 'toolResult')], isError: result.isError === true };
  }

  return result;
}

export function nativeContentReference(message: Message): Reference | undefined {
  if (message.role === 'assistant' || typeof message.content === 'string') {
    return;
  }

  const first = message.content[0];

  if (first?.type !== 'text' || !('managedContent' in first)) {
    return;
  }

  const reference = first.managedContent;

  if (isReference(reference) && reference.role === message.role && reference.token === first.text) {
    return reference;
  }

  throw new Error('Invalid private session content reference');
}

export type NativeEventReader = (id: string) => Promise<ManagedEvent | undefined>;

export async function hydrateNativeMessage(
  message: Message,
  reference: Reference,
  read: NativeEventReader,
): Promise<Message> {
  const event = await read(reference.eventId);

  if (event?.id !== reference.eventId) {
    throw new Error('The private session input is unavailable');
  }

  switch (message.role) {
    case 'user':
      if (event.type === 'user.message') {
        return { ...message, content: managedInputContent(event) };
      }

      break;
    case 'toolResult':
      if (toolResultTypes.has(event.type)) {
        const result = managedResultContent(event);

        return { ...message, content: [...(result.output ?? []), ...message.content.slice(1)] };
      }

      break;
    case 'system':
      if (event.type === 'system.message') {
        return { ...message, content: [...textBlocks(event['content'])] };
      }

      break;
    case 'assistant':
      break;
  }

  throw new Error('The private session input has an unexpected role');
}

export async function hydrateNativeMessages(messages: ReadonlyArray<Message>, read: NativeEventReader) {
  const updated = [...messages];

  for (const [index, message] of messages.entries()) {
    const reference = nativeContentReference(message);

    if (reference !== undefined) {
      updated[index] = await hydrateNativeMessage(message, reference, read);
    }
  }

  return { messages: updated };
}
