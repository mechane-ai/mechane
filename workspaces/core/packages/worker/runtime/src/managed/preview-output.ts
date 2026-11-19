import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { EntryRecord, Tx } from '@earendil-works/pi-durable';
import { appendManagedEvent, managedStableEventId, readManagedEvent } from './event-log/write.ts';
import { responseKey } from './preview-coordinates.ts';

export type PublicGeneration = { readonly sessionId: string; readonly taskId: number };

export function createGenerationRegistry() {
  const requests = new WeakMap<AbortSignal, PublicGeneration>();

  function mark(signal: AbortSignal | undefined, generation: PublicGeneration) {
    if (signal !== undefined) {
      requests.set(signal, generation);
    }
  }

  function take(signal?: AbortSignal): PublicGeneration | undefined {
    if (signal === undefined) {
      return;
    }

    const generation = requests.get(signal);

    requests.delete(signal);

    return generation;
  }

  return { mark, take };
}

export type GenerationRegistry = ReturnType<typeof createGenerationRegistry>;

export async function appendManagedAssistant(transaction: Tx, generation: PublicGeneration, message: AssistantMessage) {
  const { sessionId, taskId } = generation;

  if (message.content.some((block) => block.type === 'thinking')) {
    await appendManagedEvent(
      transaction,
      { sessionId, stableKey: responseKey(taskId, message.timestamp, 'agent.thinking') },
      { type: 'agent.thinking' },
    );
  }

  const content = message.content
    .filter((block) => block.type === 'text')
    .map((block) => ({ type: 'text', text: block.text }));

  if (content.length === 0) {
    return;
  }

  return await appendManagedEvent(
    transaction,
    { sessionId, stableKey: responseKey(taskId, message.timestamp, 'agent.message') },
    { type: 'agent.message', content },
  );
}

export async function readManagedAnswer(transaction: Tx, sessionId: string, answer: EntryRecord) {
  const message = answer.model?.find((candidate) => candidate.role === 'assistant');

  if (
    answer.byTaskId === undefined ||
    message === undefined ||
    !message.content.some((block) => block.type === 'text')
  ) {
    return;
  }

  const id = await managedStableEventId(
    sessionId,
    null,
    responseKey(answer.byTaskId, message.timestamp, 'agent.message'),
  );

  return await readManagedEvent(transaction, sessionId, id);
}
