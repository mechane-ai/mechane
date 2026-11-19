import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { HttpHeader, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import type { ResolveDelegationTarget } from './delegation/dispatch.ts';
import { withDelegationOrigin } from './delegation/receiver-origin.ts';
import { Children } from './delegation/records.ts';
import type { Child } from './delegation/records.ts';
import { PreviewDelivery } from './preview-coordinates.ts';
import type { ManagedDelegationPreview, PreviewSink } from './preview-coordinates.ts';
import { watchConversationPreviews } from './preview.ts';
import type { ManagedAgentScope, ManagedStreamInput } from './protocol.ts';
import { sessionState } from './scheduler.ts';
import type { SessionObserver } from './session-observer.ts';
import type { ManagedSessionReader } from './session-reader.ts';

const decodeFrame = Schema.decodeUnknownSync(Schema.fromJsonString(PreviewDelivery));

async function consumeFrames(body: ReadableStream<string>, emit: PreviewSink, signal: AbortSignal) {
  const reader = body.getReader();
  let buffered = '';
  let shedSpan = '';

  function consumeLines(chunk: string) {
    const lines = (buffered + chunk).split('\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (line.length > 0) {
        const delivery = decodeFrame(line);

        if (delivery.spanId !== shedSpan && !emit(delivery)) {
          shedSpan = delivery.spanId;
        }
      }
    }
  }

  function cancel() {
    void reader.cancel().catch(() => undefined);
  }

  signal.addEventListener('abort', cancel, { once: true });

  try {
    while (!signal.aborted) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      consumeLines(chunk.value);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

type Subscription = { readonly emit: PreviewSink; readonly signal: AbortSignal; readonly source: EventTarget };

type PublicSubscription = {
  readonly reader: ManagedSessionReader;
  readonly observe: SessionObserver;
  readonly scope: ManagedStreamInput;
  readonly delegate: ResolveDelegationTarget;
};

export async function watchSessionPreviews(
  { reader, observe, scope, delegate }: PublicSubscription,
  observer: Subscription,
) {
  const types = scope.eventDeltas;

  if (types === undefined || types.length === 0 || observer.signal.aborted) {
    return;
  }

  const route = await reader.harness.commit(async (transaction) => {
    const state = await sessionState(transaction, scope.sessionId);

    if (scope.threadId === undefined || scope.threadId === state.threadId) {
      return { isPrimary: true } as const;
    }

    return { child: await Children.read(transaction, scope.threadId) };
  }, BACKGROUND_CONTEXT);

  if ('isPrimary' in route) {
    await observe.watch(observer.signal, async (engine, signal) => {
      const conversation = await engine.harness.commit(async (transaction) => {
        const state = await sessionState(transaction, scope.sessionId);

        return state.conversation;
      }, BACKGROUND_CONTEXT);

      if (conversation !== null) {
        await watchConversationPreviews({
          harness: engine.harness,
          sessionId: scope.sessionId,
          conversationId: conversation,
          types,
          emit: observer.emit,
          signal,
        });
      }
    });

    return;
  }

  if (route.child?.retirement === 'live') {
    await watchChild({ child: route.child, observe, eventDeltas: types, delegate }, observer);
  }
}

type ChildSubscription = {
  readonly child: Child;
  readonly observe: SessionObserver;
  readonly eventDeltas: ManagedDelegationPreview['eventDeltas'];
  readonly delegate: ResolveDelegationTarget;
};

async function watchChild({ child, observe, eventDeltas, delegate }: ChildSubscription, observer: Subscription) {
  const { signal, emit } = observer;
  const origin = child.origin;
  const target = delegate(origin.childAgentId);

  async function connect() {
    const response = await target.delegatePreviews({ origin, eventDeltas, signal });

    if (response.body !== null) {
      void consumeFrames(response.body.pipeThrough(new TextDecoderStream()), emit, signal).catch(() => undefined);
    }
  }

  if (child.isOpened) {
    await connect();

    return;
  }

  const threadId = origin.threadId;
  const ready = new AbortController();
  const listening = AbortSignal.any([ready.signal, signal]);

  async function onChange() {
    const current = await observe.read((reader) => Children.get(reader.harness, threadId));

    if (listening.aborted) {
      return;
    }

    if (current === undefined || current.retirement !== 'live') {
      ready.abort();

      return;
    }

    if (current.isOpened) {
      ready.abort();
      await connect();
    }
  }

  function check() {
    void onChange().catch(() => ready.abort());
  }

  observer.source.addEventListener('change', check, { signal: listening });
  check();
}

type PrivateSubscription = {
  readonly reader: ManagedSessionReader;
  readonly observe: SessionObserver;
  readonly scope: ManagedAgentScope;
  readonly input: ManagedDelegationPreview;
  readonly signal: AbortSignal;
  readonly onStreamClose?: (() => void) | undefined;
};

export async function delegatedPreviews({ reader, observe, scope, input, signal, onStreamClose }: PrivateSubscription) {
  const id = input.origin.threadId;

  async function conversationFor(owner: Pick<ManagedSessionReader, 'harness'>) {
    return await withDelegationOrigin(
      owner.harness,
      { scope, origin: input.origin, access: 'active' },
      async (transaction) => {
        const state = await sessionState(transaction, id);

        return state.conversation;
      },
    );
  }

  await conversationFor(reader);

  const encoder = new TextEncoder();
  const canceled = new AbortController();

  function dispose() {
    if (canceled.signal.aborted) {
      return;
    }

    canceled.abort();
    onStreamClose?.();
  }

  let ready = Promise.resolve();

  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        function disconnect() {
          dispose();
          controller.close();
        }

        if (signal.aborted) {
          disconnect();

          return;
        }

        signal.addEventListener('abort', disconnect, { signal: canceled.signal, once: true });

        ready = observe
          .watch(canceled.signal, async (current, lifetime) => {
            const conversation = await conversationFor(current);

            if (conversation === null || lifetime.aborted) {
              return;
            }

            await watchConversationPreviews({
              harness: current.harness,
              sessionId: id,
              conversationId: conversation,
              types: input.eventDeltas,
              signal: lifetime,
              emit: (delivery) => {
                if (lifetime.aborted || (controller.desiredSize ?? 0) <= 0) {
                  return false;
                }

                controller.enqueue(encoder.encode(`${JSON.stringify(delivery)}\n`));

                return true;
              },
            });
          })
          .catch((error: unknown) => {
            dispose();
            controller.error(error);
          });
      },
      cancel: dispose,
    },
    { highWaterMark: 16 },
  );

  await ready;

  return new Response(body, { headers: { [HttpHeader.ContentType]: MediaType.Ndjson } });
}
