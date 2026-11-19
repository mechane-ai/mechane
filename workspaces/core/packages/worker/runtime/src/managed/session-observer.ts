import type { ManagedAgentEngine } from './engine.ts';
import type { ManagedSessionReader } from './session-reader.ts';

type Attach = (engine: ManagedAgentEngine, signal: AbortSignal) => Promise<void>;

export type SessionObserver = {
  readonly read: <T>(operation: (reader: ManagedSessionReader) => Promise<T>) => Promise<T>;
  readonly watch: (signal: AbortSignal, attach: Attach) => Promise<void>;
};

type Generation = { readonly engine: ManagedAgentEngine; readonly lifetime: AbortController };

type Watcher = { readonly signal: AbortSignal; readonly attach: Attach };

async function attachPreview(watcher: Watcher, generation: Generation) {
  const failed = new AbortController();
  const lifetime = AbortSignal.any([watcher.signal, generation.lifetime.signal, failed.signal]);

  try {
    await watcher.attach(generation.engine, lifetime);
  } catch (failure) {
    failed.abort();

    throw failure;
  }
}

export function createSessionObserver(read: SessionObserver['read']) {
  const watchers = new Set<Watcher>();
  const current: { generation?: Generation } = {};

  async function watch(signal: AbortSignal, attach: Attach) {
    if (signal.aborted) {
      return;
    }

    const initial = current.generation;

    const watcher = { signal, attach };

    function remove() {
      watchers.delete(watcher);
    }

    watchers.add(watcher);
    signal.addEventListener('abort', remove, { once: true });

    if (initial === undefined) {
      return;
    }

    try {
      await attachPreview(watcher, initial);
    } catch (failure) {
      remove();
      signal.removeEventListener('abort', remove);

      throw failure;
    }
  }

  async function open(engine: ManagedAgentEngine) {
    const generation = { engine, lifetime: new AbortController() };

    current.generation = generation;

    await Promise.allSettled(Array.from(watchers, (watcher) => attachPreview(watcher, generation)));
  }

  function close() {
    current.generation?.lifetime.abort();

    delete current.generation;
  }

  return { observe: { read, watch }, open, close };
}
