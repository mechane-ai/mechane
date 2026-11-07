import { Schema } from 'effect';
import type { CanonicalTables } from './collections.ts';
import type { ReadKind, ReadReceipt, ReadRequest } from './requests.ts';

class IncompleteRead extends Schema.TaggedError<IncompleteRead>()('IncompleteRead', { read: Schema.String }) {}

type WaitForRead = {
  readonly receipts: CanonicalTables['reads'];
  readonly tables: CanonicalTables;
  readonly request: ReadRequest;
  readonly signal: AbortSignal;
  readonly refreshRead: () => Promise<number>;
};

type ReadSource = {
  readonly status: CanonicalTables['mechs']['status'];
  readonly preload: () => Promise<unknown>;
  readonly subscribeChanges: (listener: () => void) => { readonly unsubscribe: () => void };
  readonly on: (type: 'health:change', listener: () => void) => () => void;
};

function hasReadRows(tables: CanonicalTables, receipt: ReadReceipt): boolean {
  switch (receipt.kind) {
    case 'mechs':
      return receipt.keys.every((key) => tables.mechs.has(key));
    case 'mech':
      return (
        receipt.keys.length === 1 &&
        receipt.keys.every((key) => {
          const summary = tables.mechs.get(key);
          const definition = tables.mechDefinitions.get(key);

          return (
            summary !== undefined && definition !== undefined && summary.value.revision === definition.value.revision
          );
        })
      );
    case 'threads':
      return receipt.keys.every((key) => tables.threads.has(key));
    case 'memories':
      return receipt.keys.every((key) => tables.memories.has(key));
    case 'turns':
      return receipt.keys.every((key) => tables.turns.has(key));
    case 'trace':
      return (
        receipt.keys.length === 1 && receipt.keys.every((key) => tables.turns.has(key) && tables.traceEvidence.has(key))
      );
    case 'events':
    case 'turnEvents':
      return receipt.keys.every((key) => tables.events.has(key));
    case 'slackBindings':
      return receipt.keys.every((key) => tables.slackBindings.has(key));
    case 'slackDeliveries':
      return receipt.keys.every((key) => tables.slackDeliveries.has(key));
    case 'allowance':
      return receipt.keys.length === 1 && receipt.keys.every((key) => tables.allowance.has(key));
  }
}

function tablesForRead(tables: CanonicalTables, kind: ReadKind) {
  switch (kind) {
    case 'mechs':
      return [tables.mechs];
    case 'mech':
      return [tables.mechs, tables.mechDefinitions];
    case 'threads':
      return [tables.threads];
    case 'memories':
      return [tables.memories];
    case 'turns':
      return [tables.turns];
    case 'trace':
      return [tables.turns, tables.traceEvidence];
    case 'events':
    case 'turnEvents':
      return [tables.events];
    case 'slackBindings':
      return [tables.slackBindings];
    case 'slackDeliveries':
      return [tables.slackDeliveries];
    case 'allowance':
      return [tables.allowance];
  }
}

/** Cached coverage can satisfy readiness while its tab-owned network read refreshes. */
export async function waitForRead({ receipts, tables, request, signal, refreshRead }: WaitForRead): Promise<void> {
  signal.throwIfAborted();

  const sources: ReadonlyArray<ReadSource> = [receipts, ...tablesForRead(tables, request.kind)];

  function isComplete(): boolean {
    const receipt = receipts.get(request.id);

    return receipt !== undefined && hasReadRows(tables, receipt);
  }

  const ready = Promise.withResolvers<void>();

  function check(): void {
    if (signal.aborted) {
      ready.reject(signal.reason);
    } else if (sources.some((source) => source.status === 'crashed')) {
      ready.reject(new IncompleteRead({ read: request.id }));
    } else if (sources.every((source) => source.status === 'ready') && isComplete()) {
      ready.resolve();
    }
  }

  const subscriptions = sources.map((source) => source.subscribeChanges(check));
  const healthSubscriptions = sources.map((source) => source.on('health:change', check));

  signal.addEventListener('abort', check, { once: true });
  check();

  async function refresh(): Promise<void> {
    await refreshRead();
    signal.throwIfAborted();

    if (!isComplete()) {
      throw new IncompleteRead({ read: request.id });
    }
  }

  try {
    await Promise.race([Promise.all(sources.map((source) => source.preload())), ready.promise]);
    signal.throwIfAborted();

    if (isComplete()) {
      return;
    }

    await Promise.race([ready.promise, refresh()]);
  } finally {
    signal.removeEventListener('abort', check);

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }

    for (const unsubscribe of healthSubscriptions) {
      unsubscribe();
    }
  }
}
