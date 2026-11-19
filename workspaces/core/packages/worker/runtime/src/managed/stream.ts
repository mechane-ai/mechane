import { HttpHeader, MediaType } from '@mechane/records';
import { observeEvent } from '@mechane/utilities';
import type { PreviewSink } from './preview-coordinates.ts';
import { previewWindow } from './preview-window.ts';
import type { ManagedEvent, ManagedEventScope, ManagedStreamInput } from './protocol.ts';

type EventChanges = { readonly data: ReadonlyArray<ManagedEvent>; readonly offset: number };

type ReadChanges = (input: ManagedEventScope & { readonly offset: number }) => Promise<EventChanges>;

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
  readonly onStreamClose?: (() => void) | undefined;
};

const KEEPALIVE_MS = 15_000;

export async function managedStream({
  offset,
  readChanges,
  scope,
  source,
  signal,
  onStreamClose,
  watchPreviews,
}: LiveStream): Promise<Response> {
  const encoder = new TextEncoder();
  const cursor = { offset, revision: 0 };
  const canceled = new AbortController();
  const pulse = new EventTarget();
  const previews = new AbortController();
  const previewSignal = AbortSignal.any([canceled.signal, previews.signal]);
  const includePreviews = (scope.eventDeltas?.length ?? 0) > 0;
  let ready = Promise.resolve();
  const live: { window?: ReturnType<typeof previewWindow> } = {};

  function isCanceled(): boolean {
    return canceled.signal.aborted;
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

  function deliver(controller: ReadableStreamDefaultController<Uint8Array>, events: ReadonlyArray<ManagedEvent>) {
    for (const event of events) {
      controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      live.window?.reconcile(event);
    }
  }

  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        function disconnect(): void {
          dispose();
          controller.close();
        }

        if (signal.aborted) {
          disconnect();

          return;
        }

        source.addEventListener('change', changed, { signal: canceled.signal });
        signal.addEventListener('abort', disconnect, { signal: canceled.signal, once: true });
        controller.enqueue(encoder.encode(': connected\n\n'));

        if (!includePreviews || watchPreviews === undefined) {
          return;
        }

        live.window = previewWindow((frame) => {
          if (previewSignal.aborted || (controller.desiredSize ?? 0) <= 0) {
            return false;
          }

          controller.enqueue(encoder.encode(`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`));

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
          while (!isCanceled()) {
            const revision = cursor.revision;
            const page = await readChanges({ ...scope, offset: cursor.offset });

            if (isCanceled()) {
              return;
            }

            cursor.offset = page.offset;

            if (page.data.length > 0) {
              deliver(controller, page.data);

              return;
            }

            const elapsed = await wait(revision);

            if (elapsed && !isCanceled()) {
              controller.enqueue(encoder.encode(': keepalive\n\n'));

              return;
            }
          }
        } catch (failure) {
          dispose();
          controller.error(failure);
        }
      },
      cancel: dispose,
    },
    { highWaterMark: 16 },
  );

  await ready;

  return new Response(body, {
    headers: { [HttpHeader.ContentType]: MediaType.EventStream, [HttpHeader.CacheControl]: 'no-store' },
  });
}
