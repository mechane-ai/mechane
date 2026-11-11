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

type ReadDefinition = { readonly tables: ReadonlyArray<keyof CanonicalTables>; readonly cardinality: 'one' | 'many' };

const readDefinitions = {
  mechs: { tables: ['mechs'], cardinality: 'many' },
  mech: { tables: ['mechs', 'mechDefinitions'], cardinality: 'one' },
  turns: { tables: ['turns'], cardinality: 'many' },
  trace: { tables: ['turns', 'traceEvidence'], cardinality: 'one' },
  events: { tables: ['events'], cardinality: 'many' },
  turnEvents: { tables: ['events'], cardinality: 'many' },
  evidence: { tables: ['evidenceArtifacts'], cardinality: 'many' },
  evidenceArtifact: { tables: ['evidenceArtifacts'], cardinality: 'one' },
  environment: { tables: ['environments'], cardinality: 'one' },
  environmentProcess: { tables: ['environmentProcessDetails'], cardinality: 'one' },
  allowance: { tables: ['allowance'], cardinality: 'one' },
} as const satisfies Readonly<Record<ReadKind, ReadDefinition>>;

function hasReadRows(tables: CanonicalTables, receipt: ReadReceipt): boolean {
  const definition = readDefinitions[receipt.kind];

  if (definition.cardinality === 'one' && receipt.keys.length !== 1) {
    return false;
  }

  if (!definition.tables.every((name) => receipt.keys.every((key) => tables[name].has(key)))) {
    return false;
  }

  if (receipt.kind === 'mech') {
    return receipt.keys.every((key) => {
      const summary = tables.mechs.get(key);
      const mechDefinition = tables.mechDefinitions.get(key);

      return (
        summary !== undefined &&
        mechDefinition !== undefined &&
        summary.value.revision === mechDefinition.value.revision
      );
    });
  }

  return true;
}

/** Cached coverage can satisfy readiness while its tab-owned network read refreshes. */
export async function waitForRead({ receipts, tables, request, signal, refreshRead }: WaitForRead): Promise<void> {
  signal.throwIfAborted();

  const sources: ReadonlyArray<ReadSource> = [
    receipts,
    ...readDefinitions[request.kind].tables.map((name) => tables[name]),
  ];

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
