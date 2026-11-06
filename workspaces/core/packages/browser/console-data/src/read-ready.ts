import { createLiveQueryCollection, eq } from '@tanstack/db';
import type { Collection } from '@tanstack/db';
import type { QueryCollectionUtils } from '@tanstack/query-db-collection';
import { MutableRef, Schema } from 'effect';
import type { CanonicalTables } from './collections.ts';
import type { ReadKind, ReadReceipt, ReadRequest } from './requests.ts';

class IncompleteRead extends Schema.TaggedError<IncompleteRead>()('IncompleteRead', { read: Schema.String }) {}

type ReceiptCollection = Collection<
  ReadReceipt,
  string,
  QueryCollectionUtils<ReadReceipt, string, typeof ReadReceipt.Encoded>,
  ReturnType<typeof Schema.toStandardSchemaV1<typeof ReadReceipt>>,
  typeof ReadReceipt.Encoded
>;

type WaitForRead = {
  readonly receipts: ReceiptCollection;
  readonly tables: CanonicalTables;
  readonly request: ReadRequest;
  readonly signal: AbortSignal;
  readonly refreshRead: () => Promise<ReadonlyArray<ReadReceipt>>;
  readonly reportLocalFailure: (error: unknown) => void;
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

/** Holds an exact native demand until its receipt and every referenced canonical row are ready. */
export async function waitForRead({
  receipts,
  tables,
  request,
  signal,
  refreshRead,
  reportLocalFailure,
}: WaitForRead): Promise<void> {
  signal.throwIfAborted();

  const view = createLiveQueryCollection((query) =>
    query.from({ receipt: receipts }).where(({ receipt }) => eq(receipt.id, request.id)),
  );

  const applied = Promise.withResolvers<void>();
  const repair = MutableRef.make<ReadReceipt | undefined>(undefined);

  async function cancel(): Promise<void> {
    try {
      await view.cleanup();
    } catch (error) {
      if (!signal.aborted) {
        reportLocalFailure(error);
      }
    }
  }

  function onAbort(): void {
    void cancel();
  }

  function check(): void {
    const expected = repair.current;
    const current = receipts.get(request.id);

    if (signal.aborted) {
      applied.reject(signal.reason);

      return;
    }

    if (receipts.status === 'crashed') {
      applied.reject(new IncompleteRead({ read: request.id }));

      return;
    }

    if (expected === undefined || current === undefined) {
      return;
    }

    const isSameResponse = current.fetchedAtMs === expected.fetchedAtMs && current.hasMore === expected.hasMore;

    const hasSameKeys =
      current.keys.length === expected.keys.length && current.keys.every((key, index) => key === expected.keys[index]);

    if (isSameResponse && hasSameKeys && hasReadRows(tables, current)) {
      applied.resolve();
    }
  }

  async function refresh(): Promise<void> {
    const rows = await refreshRead();

    repair.current = rows[0];

    check();
  }

  signal.addEventListener('abort', onAbort, { once: true });

  try {
    await view.preload();
    await Promise.all(tablesForRead(tables, request.kind).map((table) => table.preload()));
    signal.throwIfAborted();

    const receipt = receipts.get(request.id);

    if (receipt === undefined || !hasReadRows(tables, receipt)) {
      const subscription = view.subscribeChanges(check);
      const unsubscribeHealth = receipts.on('health:change', check);

      signal.addEventListener('abort', check, { once: true });

      try {
        await Promise.all([refresh(), applied.promise]);
      } finally {
        subscription.unsubscribe();
        unsubscribeHealth();
        signal.removeEventListener('abort', check);
      }
    }

    const confirmed = receipts.get(request.id);

    if (confirmed === undefined || !hasReadRows(tables, confirmed)) {
      throw new IncompleteRead({ read: request.id });
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    await cancel();
  }
}
