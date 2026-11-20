import { HttpHeader, MediaType } from '@mechane/records';
import { observeEvent } from '@mechane/utilities';
import type { PreviewSink } from './preview-coordinates.ts';
import { previewWindow } from './preview-window.ts';
import type { ManagedEvent, ManagedEventScope, ManagedStreamInput } from './protocol.ts';

type EventChanges = { readonly data: ReadonlyArray<ManagedEvent>; readonly offset: number };

type ReadChanges = (input: ManagedEventScope & { readonly offset: number }) => Promise<EventChanges>;

type DeletedSubscription = (listener: (event: ManagedEvent) => void, signal: AbortSignal) => void;

type LiveStream = {
  readonly watchPreviews?: (observer: {
    readonly emit: PreviewSink;
    readonly signal: AbortSignal;
    readonly source: EventTarget;
  }) => Promise<void>;
  readonly offset: number;
  readonly readChanges: ReadChanges;
  readonly scope: ManagedStreamInput;
  readonly source: EventTarget;
  readonly signal: AbortSignal;
  readonly subscribeDeleted?: DeletedSubscription | undefined;
  readonly onStreamClose?: (() => void) | undefined;
};

const KEEPALIVE_MS = 15_000;
const RETRY_MS = 3000;
const TERMINAL_SESSION_EVENTS: ReadonlySet<string> = new Set(['session.status_terminated', 'session.deleted']);

function isTerminalStreamEvent(type: string, isThreadStream: boolean): boolean {
  if (TERMINAL_SESSION_EVENTS.has(type)) {
    return true;
  }

  return isThreadStream && type === 'session.thread_status_terminated';
}

export async function managedStream({
  offset,
  readChanges,
  scope,
  source,
  signal,
  subscribeDeleted,
  onStreamClose,
  watchPreviews,
}: LiveStream): Promise<Response> {
  const encoder = new TextEncoder();
  const cursor = { offset, revision: 0 };
  const streamState = { isClosed: false };
  const canceled = new AbortController();
  const pulse = new EventTarget();
  const previews = new AbortController();
  const previewSignal = AbortSignal.any([canceled.signal, previews.signal]);
  const includePreviews = (scope.eventDeltas?.length ?? 0) > 0;
  const isThreadStream = scope.threadId !== undefined;
  let ready = Promise.resolve();
  const live: { window?: ReturnType<typeof previewWindow> } = {};

  function isCanceled(): boolean {
    return canceled.signal.aborted;
  }

  function isClosed(): boolean {
    return streamState.isClosed;
  }

  function changed(): void {
    cursor.revision += 1;

    pulse.dispatchEvent(new Event('change'));
  }

  async function wait(revision: number): Promise<boolean> {
    if (isCanceled() || cursor.revision !== revision) {
      return false;
    }

    const deadline = AbortSignal.timeout(KEEPALIVE_MS);
    const change = observeEvent({ source: pulse, type: 'change', stop: AbortSignal.any([canceled.signal, deadline]) });

    await change.observed;

    return deadline.aborted;
  }

  function dispose(): void {
    if (canceled.signal.aborted) {
      return;
    }

    canceled.abort();
    onStreamClose?.();
    changed();
  }

  function closeStream(controller: ReadableStreamDefaultController<Uint8Array>): void {
    if (streamState.isClosed) {
      return;
    }

    streamState.isClosed = true;

    dispose();
    controller.close();
  }

  function deliver(
    controller: ReadableStreamDefaultController<Uint8Array>,
    events: ReadonlyArray<ManagedEvent>,
  ): boolean {
    for (const event of events) {
      if (streamState.isClosed || isCanceled()) {
        return true;
      }

      const payload = JSON.stringify(event);
      const chunk = encoder.encode(`id: ${event.id}\nevent: ${event.type}\ndata: ${payload}\n\n`);

      controller.enqueue(chunk);
      live.window?.reconcile(event);

      if (isTerminalStreamEvent(event.type, isThreadStream)) {
        closeStream(controller);

        return true;
      }
    }

    return false;
  }

  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        function disconnect(): void {
          closeStream(controller);
        }

        if (signal.aborted) {
          disconnect();

          return;
        }

        source.addEventListener('change', changed, { signal: canceled.signal });
        signal.addEventListener('abort', disconnect, { signal: canceled.signal, once: true });
        subscribeDeleted?.((event) => {
          deliver(controller, [event]);
        }, canceled.signal);
        controller.enqueue(encoder.encode(`retry: ${RETRY_MS}\n: connected\n\n`));

        if (!includePreviews || watchPreviews === undefined) {
          return;
        }

        live.window = previewWindow((frame) => {
          const isStopped = isClosed() || previewSignal.aborted;

          if (isStopped || (controller.desiredSize ?? 0) <= 0) {
            return false;
          }

          const payload = JSON.stringify(frame);
          const chunk = encoder.encode(`event: ${frame.type}\ndata: ${payload}\n\n`);

          controller.enqueue(chunk);

          return true;
        });

        const window = live.window;

        ready = watchPreviews({
          source,
          signal: previewSignal,
          emit: (delivery) => {
            changed();

            return window.receive(delivery);
          },
        }).catch(() => {
          previews.abort();
        });
      },
      async pull(controller) {
        try {
          while (!isCanceled() && !isClosed()) {
            const revision = cursor.revision;
            const page = await readChanges({ ...scope, offset: cursor.offset });

            if (isCanceled() || isClosed()) {
              return;
            }

            cursor.offset = page.offset;

            if (page.data.length > 0) {
              deliver(controller, page.data);

              return;
            }

            const elapsed = await wait(revision);

            if (elapsed && !isCanceled() && !isClosed()) {
              controller.enqueue(encoder.encode(': keepalive\n\n'));

              return;
            }
          }
        } catch (failure) {
          if (!isClosed()) {
            streamState.isClosed = true;

            dispose();
            controller.error(failure);
          }
        }
      },
      cancel() {
        streamState.isClosed = true;

        dispose();
      },
    },
    { highWaterMark: 16 },
  );

  await ready;

  return new Response(body, {
    headers: {
      [HttpHeader.ContentType]: MediaType.EventStream,
      [HttpHeader.CacheControl]: 'no-store',
      [HttpHeader.XAccelBuffering]: 'no',
    },
  });
}
