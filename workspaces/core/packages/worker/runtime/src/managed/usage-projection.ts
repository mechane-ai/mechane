import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Session, Tx } from '@earendil-works/pi-durable';
import type { ControlStore } from '@mechane/control-store';
import { serialCalls } from '@mechane/utilities';
import { Schema } from 'effect';
import { actorRecordCollection, actorRecordSet } from '../actor/record-store.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { appendManagedEvent } from './event-log/write.ts';
import type { ManagedEvent } from './protocol.ts';
import { threadRecords } from './thread-records.ts';

const Scope = { id: Schema.String, sessionId: Schema.String, at: Schema.String } as const;

const Receipt = Schema.Union([
  Schema.Struct({ ...Scope, kind: Schema.Literal('activity'), threadId: Schema.String, isRunning: Schema.Boolean }),
  Schema.Struct({ ...Scope, kind: Schema.Literal('thread'), threadId: Schema.String }),
  Schema.Struct({ ...Scope, kind: Schema.Literal('session') }),
]);

type Receipt = typeof Receipt.Type;

const dirty = actorRecordSet('managed.usage-pending');

function receipts(sessionId: string) {
  return actorRecordCollection(JSON.stringify(['managed.usage', sessionId]), Receipt);
}

async function queue(transaction: Tx, localId: string, receipt: Receipt) {
  await receipts(localId).put(transaction, receipt.id, receipt);
  await dirty.put(transaction, localId, localId);
}

type ThreadScope = {
  readonly localId: string;
  readonly sessionId: string;
  readonly threadId: string;
  readonly at: number;
};

export async function queueThreadUsage(transaction: Tx, input: ThreadScope, isRunning?: boolean) {
  const scope = {
    sessionId: input.sessionId,
    threadId: input.threadId,
    id: crypto.randomUUID(),
    at: new Date(input.at).toISOString(),
  };

  if (isRunning === undefined) {
    await queue(transaction, input.localId, { ...scope, kind: 'thread' });
  } else {
    await queue(transaction, input.localId, { ...scope, kind: 'activity', isRunning });
  }

  return scope.id;
}

export async function queueSessionUsage(transaction: Tx, sessionId: string) {
  const event = await appendManagedEvent(transaction, { sessionId }, { type: 'session.usage' });

  if (event.processed_at === null) {
    throw new Error('Session usage needs a processing timestamp.');
  }

  await queue(transaction, sessionId, { kind: 'session', id: event.id, at: event.processed_at, sessionId });
}

type UsageControlStore = Pick<ControlStore, 'recordManagedThreadActivity' | 'getManagedSessionUsage'>;

type Options = {
  readonly harness: Session;
  readonly workspaceId: string;
  readonly withControl: <T>(operation: (store: UsageControlStore) => Promise<T>) => Promise<T>;
};

export function managedUsageProjector({ harness, workspaceId, withControl }: Options) {
  const calls = serialCalls();

  async function flushSession(localId: string) {
    const pending = receipts(localId);

    async function applyPage(): Promise<boolean> {
      const page = await pending.page(harness, { maxRows: 32 });

      if (page.items.length === 0) {
        await harness.commit(async (transaction) => {
          if ((await pending.countInTransaction(transaction)) === 0) {
            await dirty.remove(transaction, localId);
          }
        }, BACKGROUND_CONTEXT);

        return false;
      }

      const settled = await withControl(async (store) => {
        const snapshots: Array<{
          readonly receipt: Receipt;
          readonly snapshot: Awaited<ReturnType<typeof store.getManagedSessionUsage>> | null;
        }> = [];

        for (const receipt of page.items) {
          const scope = { workspaceId, sessionId: receipt.sessionId };

          if (receipt.kind === 'activity') {
            await store.recordManagedThreadActivity({
              ...scope,
              threadId: receipt.threadId,
              eventId: receipt.id,
              at: receipt.at,
              isRunning: receipt.isRunning,
            });

            snapshots.push({ receipt, snapshot: null });
          } else if (receipt.kind === 'thread') {
            const snapshot = await store.getManagedSessionUsage({
              ...scope,
              threadId: receipt.threadId,
              asOf: receipt.at,
            });

            snapshots.push({ receipt, snapshot });
          } else {
            const snapshot = await store.getManagedSessionUsage({ ...scope, asOf: receipt.at });

            snapshots.push({ receipt, snapshot });
          }
        }

        return snapshots;
      });

      await harness.commit(async (transaction) => {
        async function commitSnapshot({ receipt, snapshot }: (typeof settled)[number]) {
          if ((await pending.read(transaction, receipt.id)) === undefined) {
            return;
          }

          if (receipt.kind === 'session' && snapshot !== null) {
            const journal = sessionEvents(localId);
            const row = await journal.read(transaction, receipt.id);

            if (row?.event.type !== 'session.usage') {
              throw new Error('Missing session usage event.');
            }

            await journal.put(transaction, receipt.id, {
              ...row,
              event: { ...row.event, budget: snapshot.budget, usage: snapshot.usage },
            });
          }

          if (receipt.kind === 'thread' && snapshot !== null) {
            const records = threadRecords(localId);
            const thread = await records.read(transaction, receipt.threadId);

            if (thread?.usagePendingId === receipt.id) {
              await records.put(transaction, thread.id, { ...thread, usage: snapshot.usage, usagePendingId: null });
            }
          }

          await pending.remove(transaction, receipt.id);
        }

        for (const entry of settled) {
          await commitSnapshot(entry);
        }

        if (!page.hasMore && (await pending.countInTransaction(transaction)) === 0) {
          await dirty.remove(transaction, localId);
        }
      }, BACKGROUND_CONTEXT);

      return page.hasMore;
    }

    let hasMore = true;

    while (hasMore) {
      hasMore = await applyPage();
    }
  }

  return async (localId?: string) =>
    await calls.run({
      run: async () => {
        if (localId !== undefined) {
          if ((await dirty.get(harness, localId)) !== undefined) {
            await flushSession(localId);
          }

          return;
        }

        for (const id of await dirty.all(harness)) {
          await flushSession(id);
        }
      },
    });
}

export async function readPublishedUsagePage<T extends { readonly data: ReadonlyArray<ManagedEvent> }>(
  input: { readonly harness: Session; readonly localId: string; readonly flush: (id: string) => Promise<void> },
  page: T,
): Promise<T> {
  const { harness, localId, flush } = input;
  const missing = page.data.filter((event) => event.type === 'session.usage' && event['usage'] === undefined);

  if (missing.length === 0) {
    return page;
  }

  await flush(localId);

  const published = new Map<string, ManagedEvent>();

  for (const event of missing) {
    const row = await sessionEvents(localId).get(harness, event.id);

    if (row?.event['usage'] === undefined) {
      throw new Error('Session usage receipt could not be published.');
    }

    published.set(event.id, row.event);
  }

  return { ...page, data: page.data.map((event) => published.get(event.id) ?? event) };
}
