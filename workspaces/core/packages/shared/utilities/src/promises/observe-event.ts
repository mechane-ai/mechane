import { Duration } from 'effect';
import { afterSettling } from '../after-settling.ts';

type ObserveEventInput = { readonly source: EventTarget; readonly type: string; readonly stop: AbortSignal };

type ObserveTimeoutInput = ObserveEventInput & { readonly span: Duration.Duration };

type WaitForSignalInput = { readonly span: Duration.Duration; readonly stop: AbortSignal };

type EventObservation = { readonly observed: Promise<void>; readonly dispose: () => void };

/** Registers before the caller checks durable state so a concurrent change cannot be missed. */
export function observeEvent({ source, type, stop }: ObserveEventInput): EventObservation {
  const observed = Promise.withResolvers<void>();

  function dispose(): void {
    source.removeEventListener(type, complete);
    stop.removeEventListener('abort', complete);
  }

  function complete(): void {
    dispose();
    observed.resolve();
  }

  source.addEventListener(type, complete, { once: true });
  stop.addEventListener('abort', complete, { once: true });

  if (stop.aborted) {
    complete();
  }

  return { observed: observed.promise, dispose };
}

/** Registers for an event before checking state, waking when the event fires, `stop` aborts, or `span` elapses. */
export function observeEventWithTimeout({ source, type, span, stop }: ObserveTimeoutInput): EventObservation {
  const timeout = new AbortController();
  const combined = AbortSignal.any([stop, timeout.signal]);
  const base = observeEvent({ source, type, stop: combined });
  const millis = Duration.toMillis(span);

  const timer = setTimeout(() => {
    timeout.abort();
  }, millis);

  function dispose(): void {
    clearTimeout(timer);
    base.dispose();
  }

  const observed = afterSettling({ promise: base.observed, run: dispose });

  return { observed, dispose };
}

/** Waits out `span` or wakes immediately when `stop` aborts, clearing the timer cleanly. */
export async function waitForSignal({ span, stop }: WaitForSignalInput): Promise<void> {
  if (stop.aborted) {
    return;
  }

  const done = Promise.withResolvers<void>();
  const millis = Duration.toMillis(span);
  const timer = setTimeout(complete, millis);

  function complete(): void {
    clearTimeout(timer);
    stop.removeEventListener('abort', complete);
    done.resolve();
  }

  stop.addEventListener('abort', complete, { once: true });

  await done.promise;
}
