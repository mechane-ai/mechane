type ObserveEventInput = { readonly source: EventTarget; readonly type: string; readonly stop: AbortSignal };

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
