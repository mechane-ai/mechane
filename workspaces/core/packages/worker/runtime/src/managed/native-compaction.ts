import type { Context } from '@earendil-works/chord/context';
import type { Message, TranscriptContext } from '@earendil-works/pi-ai';
import { CompactionTask, defineDocFamily, GenerationTask, hook, ProviderDoc } from '@earendil-works/pi-durable';
import type { Harness, TaskId } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { hydrateNativeMessage, hydrateNativeMessages, nativeContentReference } from './large-native-content.ts';

type SummaryReference = { readonly token: string; readonly eventId: string; readonly role: 'user' | 'toolResult' };
type SummarySource = { readonly taskId: TaskId | null; readonly sessionId: string; readonly references: string };

const SummaryReferenceValue = Schema.Struct({
  token: Schema.String,
  eventId: Schema.String,
  role: Schema.Literals(['user', 'toolResult']),
});

const SummaryInputs = defineDocFamily<SummarySource, null>({
  kind: 'managed.compaction-source',
  version: 1,
  family: true,
  scope: 'session',
  initial: () => ({ taskId: null, sessionId: '', references: '[]' }),
  checkpointWhen: () => true,
});

const decodeReferences = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(SummaryReferenceValue)));
const summaryRequestMessages = 2;
const toolSummaryCharacters = 2000;

function readScopedEvent(reader: ActorRecordReader, sessionId: string) {
  const rows = sessionEvents(sessionId);

  return async (id: string) => {
    const row = await rows.get(reader, id);

    return row?.event;
  };
}

export function nativeContentHooks(harness: Harness, sessionId: string) {
  return [
    hook(GenerationTask, {
      beforeRequest: async ({ messages }, api) =>
        await hydrateNativeMessages(messages, readScopedEvent(api, sessionId)),
    }),
    hook(CompactionTask, {
      beforeCompact: async ({ messages }, api, context) => {
        // Pi flattens the selected history to plain text for its summarizer. Only tokens issued
        // by this conversation and present in that history can expand in its compaction request.
        const references: Array<SummaryReference> = [];

        for (const message of messages) {
          const reference = nativeContentReference(message);

          if (reference !== undefined && reference.role !== 'system') {
            references.push({ eventId: reference.eventId, token: reference.token, role: reference.role });
          }
        }

        if (references.length === 0) {
          return;
        }

        const provider = await api.snapshot(ProviderDoc, api.conversationId, context);

        if (provider?.sessionId === undefined || provider.sessionId === '') {
          throw new Error('Missing private compaction conversation');
        }

        await harness.commit(async (transaction) => {
          const source = await transaction.doc(SummaryInputs, provider.sessionId, null);
          source.taskId = api.taskId;
          source.sessionId = sessionId;
          source.references = JSON.stringify(references);
        }, context);
      },
    }),
  ];
}

function placeholder(reference: SummaryReference): Message {
  const content = [{ type: 'text' as const, text: reference.token, managedContent: reference }];

  if (reference.role === 'user') {
    return { role: 'user', content, timestamp: 0 };
  }

  return { role: 'toolResult', toolCallId: '', toolName: '', isError: false, content, timestamp: 0 };
}

function summaryText(message: Message): string {
  if (message.role === 'assistant') {
    throw new Error('Invalid compaction source');
  }

  if (message.role === 'system') {
    throw new Error('Invalid compaction source');
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  const text = message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  if (message.role === 'toolResult' && text.length > toolSummaryCharacters) {
    const omitted = text.length - toolSummaryCharacters;

    return `${text.slice(0, toolSummaryCharacters)}\n\n[... ${omitted} more characters truncated]`;
  }

  return text;
}

export async function hydrateNativeCompaction(
  harness: Harness,
  input: { readonly transcript: TranscriptContext; readonly providerSessionId: string },
  context: Context,
): Promise<TranscriptContext> {
  const { transcript, providerSessionId } = input;
  const message = transcript.messages[1];

  if (transcript.messages.length !== summaryRequestMessages || transcript.messages[0]?.role !== 'system') {
    return transcript;
  }

  if (message?.role !== 'user' || typeof message.content === 'string') {
    return transcript;
  }

  const block = message.content[0];

  if (message.content.length !== 1 || block?.type !== 'text' || !block.text.includes('[[managed-content/')) {
    return transcript;
  }

  const source = await harness.snapshot(SummaryInputs, providerSessionId, context);

  if (source === undefined || source.taskId === null) {
    return transcript;
  }

  const task = await harness.getTask(source.taskId, context);

  if (task?.state.status !== 'running') {
    return transcript;
  }

  const read = readScopedEvent(harness, source.sessionId);
  const replacements = new Map<string, string>();

  for (const reference of decodeReferences(source.references)) {
    if (block.text.includes(reference.token)) {
      const restored = await hydrateNativeMessage(placeholder(reference), reference, read);

      replacements.set(reference.token, summaryText(restored));
    }
  }

  if (replacements.size === 0) {
    return transcript;
  }

  const text = block.text.replaceAll(
    /\[\[managed-content\/[a-f0-9-]{36}\]\]/gu,
    (token) => replacements.get(token) ?? token,
  );

  return { ...transcript, messages: [transcript.messages[0], { ...message, content: [{ ...block, text }] }] };
}
