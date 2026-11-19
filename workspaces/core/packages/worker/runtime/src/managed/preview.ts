import { BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/chord/context';
import { LiveDoc } from '@earendil-works/pi-durable';
import type { ConversationId, Harness, LiveState } from '@earendil-works/pi-durable';
import { managedStableEventId } from './event-log/write.ts';
import { activePreviewSpan, openModelSpan } from './model-spans.ts';
import { responseKey } from './preview-coordinates.ts';
import type { PreviewFrame, PreviewSink, PreviewType } from './preview-coordinates.ts';

export type PreviewObserver = { readonly emit: PreviewSink; readonly signal: AbortSignal };

type Watch = PreviewObserver & {
  readonly harness: Harness;
  readonly sessionId: string;
  readonly conversationId: ConversationId;
  readonly types: ReadonlyArray<PreviewType>;
};

type Generation = NonNullable<LiveState['generation']>;
type Message = NonNullable<Generation['message']>;
type Attempt = { readonly taskId: number; readonly timestamp: number; readonly attempt: number };

type Publisher = {
  readonly request: string;
  readonly spanId: string | undefined;
  readonly publish: (message: Message) => void;
};

async function progressFor(input: Watch, attempt: Attempt, request: string): Promise<Publisher> {
  const { taskId, timestamp } = attempt;
  const { harness, sessionId } = input;

  const [spanId, messageId, thinkingId] = await Promise.all([
    activePreviewSpan(harness, {
      sessionId,
      taskId,
      conversationId: input.conversationId,
      attempt: attempt.attempt,
      timestamp,
    }),
    managedStableEventId(sessionId, null, responseKey(taskId, timestamp, 'agent.message')),
    managedStableEventId(sessionId, null, responseKey(taskId, timestamp, 'agent.thinking')),
  ]);

  const started = new Set<PreviewType>();
  const text: Array<string> = [];
  let isStopped = false;

  function frame(value: PreviewFrame) {
    if (spanId === undefined || input.signal.aborted || !input.emit({ spanId, frame: value })) {
      isStopped = true;
    }
  }

  function start(type: PreviewType, id: string) {
    if (!started.has(type)) {
      frame({ type: 'event_start', event: { type, id } });
      started.add(type);
    }
  }

  function sendText(value: string, index: number) {
    const previous = text[index] ?? '';

    if (!value.startsWith(previous)) {
      isStopped = true;

      return;
    }

    start('agent.message', messageId);

    if (!isStopped && value.length > previous.length) {
      frame({
        type: 'event_delta',
        event_id: messageId,
        delta: { type: 'content_delta', index, content: { type: 'text', text: value.slice(previous.length) } },
      });

      text[index] = value;
    }
  }

  function publish(message: Message) {
    let index = 0;

    for (const block of message.content) {
      if (isStopped) {
        return;
      }

      if (block.type === 'thinking' && input.types.includes('agent.thinking')) {
        start('agent.thinking', thinkingId);
      }

      if (block.type === 'text' && input.types.includes('agent.message')) {
        sendText(block.text, index);

        index += 1;
      }
    }
  }

  return { request, spanId, publish };
}

export async function watchConversationPreviews(input: Watch): Promise<void> {
  const { harness, conversationId, signal } = input;

  if (signal.aborted) {
    return;
  }

  const context = withAbortSignal(signal, BACKGROUND_CONTEXT);
  const alreadyInFlight = await openModelSpan(harness);

  // A fresh conversation may have no live document until the first input. Materialize its typed empty state.
  await harness.commit(async (transaction) => {
    await transaction.doc(LiveDoc, conversationId);
  }, context);

  const watch = await harness.watchDoc(LiveDoc, conversationId, context);

  if (watch === undefined) {
    return;
  }

  const state: { progress: Publisher | null } = { progress: null };

  watch.start(async (call) => {
    if (call.kind !== 'value') {
      return;
    }

    const { run, generation } = call.value;

    if (run === undefined || generation?.message === undefined) {
      return;
    }

    const attempt = { taskId: run.taskId, timestamp: generation.message.timestamp, attempt: generation.attempt };
    const request = JSON.stringify(attempt);

    if (state.progress?.request !== request) {
      state.progress = await progressFor(input, attempt, request);
    }

    if (state.progress.spanId !== alreadyInFlight) {
      state.progress.publish(generation.message);
    }
  });
}
