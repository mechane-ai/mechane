import { Event, EventType, WAIT_MAX } from '@mechane/protocol';
import type { EventPage, InboxItem, Mech, Turn, Workspace } from '@mechane/protocol';
import { createCollection, DbClient, safeRandomUUID } from '@tanstack/db';
import type { Collection } from '@tanstack/db';
import { QueryClient } from '@tanstack/query-core';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryCollectionUtils } from '@tanstack/query-db-collection';
import { Duration, Option, Schema } from 'effect';
import { canRetainResult, createApi } from './api.ts';
import type { ConsoleApi, ConsoleOperation, Input, Output } from './api.ts';

type Snapshot<T> = { readonly key: string; readonly value: T };
/** A reactive collection containing one bounded server response. */
export type SnapshotCollection<T> = Collection<Snapshot<T>, string, QueryCollectionUtils<Snapshot<T>, string>>;

/** A server page is one snapshot, not an assertion that its rows are the entire database. */
function createResource<N extends ConsoleOperation>({
  cache,
  api,
  name,
  input,
  key,
  interval = false,
}: {
  readonly cache: QueryClient;
  readonly api: ConsoleApi;
  readonly name: N;
  readonly input: Input<N>;
  readonly key: string;
  /** Omitted for a resource that refreshes only on demand or focus. */
  readonly interval?: number | false;
}) {
  const options = queryCollectionOptions({
    id: key,
    queryClient: cache,
    queryKey: [key],
    getKey: (row: Snapshot<Output<N>>) => row.key,
    queryFn: async ({ signal }) => {
      try {
        return [{ key, value: await api(name, input, signal) }];
      } catch (error) {
        if (!canRetainResult(error)) {
          // A later transient failure must not revive a snapshot this read was denied.
          cache.setQueryData<ReadonlyArray<Snapshot<Output<N>>>>([key], (previous) =>
            previous === undefined ? undefined : [],
          );
        }

        throw error;
      }
    },
    refetchInterval: interval,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return createCollection(options);
}

const REFRESH_MS = Duration.toMillis('15 seconds');
const CACHE_MS = Duration.toMillis('1 minute');
const ACTIVITY_REFRESH_MS = Duration.toMillis('5 seconds');
const ALLOWANCE_REFRESH_MS = Duration.toMillis('30 seconds');

type OwnedCollection = { readonly id: Collection['id']; readonly cleanup: Collection['cleanup'] };

function collectionKey(workspace: string, key: string, instance: string): string {
  return `${workspace}:${key}:${instance}`;
}

type ConsoleResource<N extends ConsoleOperation> = ReturnType<typeof createResource<N>>;

/** Owned by one mounted workspace. Unmount cancels requests and destroys every protected collection. */
export function createConsoleData(origin: URL, workspace: Workspace, onSessionEnded: () => void) {
  const lifetime = new AbortController();

  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: REFRESH_MS, gcTime: CACHE_MS } },
  });

  cache.mount();

  const db = new DbClient();
  const api = createApi(origin, lifetime.signal, onSessionEnded);
  const resources = new Set<OwnedCollection>();
  const workspaceId = workspace.id;

  function resource<N extends ConsoleOperation>(
    name: N,
    input: Input<N>,
    options: {
      readonly key: string;
      /** Omitted when only demand or focus refreshes the resource. */
      readonly interval?: number | false;
    },
  ): ConsoleResource<N> {
    // A mounted live query must never see a different source instance under an earlier collection ID.
    const instance = safeRandomUUID();
    const key = collectionKey(workspaceId, options.key, instance);
    const collection = createResource({ cache, api, name, input, key, interval: options.interval ?? false });

    resources.add(collection);

    return collection;
  }

  return {
    db,
    workspace,
    api,
    mechs: (after: string | null) =>
      resource('listMechs', { workspaceId, after: Option.fromNullishOr(after) }, { key: `mechs:${after ?? 'first'}` }),
    mech: (mechId: string) =>
      resource('showMech', { workspaceId, mechId }, { key: `mech:${mechId}`, interval: REFRESH_MS }),
    turns: (mechId: string, after: Input<'listTurns'>['after']) =>
      resource(
        'listTurns',
        { workspaceId, mechId, after },
        { key: `turns:${mechId}:${Option.getOrNull(after) ?? 'latest'}`, interval: REFRESH_MS },
      ),
    trace: (mechId: string, turnId: Input<'showTurn'>['turnId']) =>
      resource('showTurn', { workspaceId, mechId, turnId }, { key: `trace:${mechId}:${turnId}`, interval: REFRESH_MS }),
    turnEvents: (mechId: string, turnId: Input<'showTurn'>['turnId'], after: number) =>
      resource(
        'listTurnEvents',
        { workspaceId, mechId, turnId, after },
        { key: `turn-events:${mechId}:${turnId}:${after}`, interval: ACTIVITY_REFRESH_MS },
      ),
    events: (mechId: string, before: number | null) =>
      resource(
        'listRecentEvents',
        { workspaceId, mechId, before: Option.fromNullishOr(before) },
        { key: `events:${mechId}:${before ?? 'latest'}`, interval: before === null ? ACTIVITY_REFRESH_MS : false },
      ),
    allowance: () => resource('showAllowance', { workspaceId }, { key: 'allowance', interval: ALLOWANCE_REFRESH_MS }),
    /** Follow the receipt cursor until this specific item joins a turn. Unmount aborts its pending long poll. */
    async messageTurn(mechId: string, receipt: InboxItem, signal: AbortSignal): Promise<Turn['id']> {
      let after: number = receipt.receivedSequence;

      let turn = Option.none<Turn['id']>();

      do {
        const page = await api('listEvents', { workspaceId, mechId, after, wait: WAIT_MAX }, signal);
        turn = Option.fromNullishOr(findMessageTurn(page.events, receipt.id));
        const last = page.events.at(-1);

        if (last !== undefined) {
          after = last.sequence;
        }
      } while (Option.isNone(turn));

      return turn.value;
    },
    async update(
      mech: Mech,
      changes: Omit<Input<'updateMech'>, 'workspaceId' | 'mechId' | 'expectedRevision'>,
    ): Promise<Mech> {
      const saved = await api('updateMech', {
        workspaceId,
        mechId: mech.id,
        expectedRevision: mech.revision,
        ...changes,
      });

      await cache.invalidateQueries();

      return saved;
    },
    async refresh(): Promise<void> {
      await cache.invalidateQueries();
    },
    retain(collection: OwnedCollection): void {
      resources.add(collection);
    },
    async release(collection: OwnedCollection): Promise<void> {
      resources.delete(collection);
      await cache.cancelQueries({ queryKey: [collection.id] });
      await collection.cleanup({ dependents: true });
      cache.removeQueries({ queryKey: [collection.id] });
    },
    async dispose(): Promise<void> {
      lifetime.abort();
      cache.unmount();
      await cache.cancelQueries();
      await db.cleanup();
      await Promise.all([...resources].map((collection) => collection.cleanup({ dependents: true })));
      resources.clear();
      cache.clear();
    },
  };
}

/** The requests and collections owned by one mounted workspace. */
export type ConsoleData = ReturnType<typeof createConsoleData>;

/** Only the start or join carrying this inbox receipt can identify its turn. */
function findMessageTurn(events: EventPage['events'], itemId: string): Turn['id'] | undefined {
  const event = events.filter(Schema.is(Event)).find((candidate) => {
    if (candidate.type === EventType.TurnStarted) {
      return candidate.inboxItemIds.includes(itemId);
    }

    return candidate.type === EventType.TurnJoined && candidate.inboxItemId === itemId;
  });

  if (event === undefined || !Schema.is(Event)(event)) {
    return undefined;
  }

  if (event.type === EventType.TurnStarted) {
    return event.turnId;
  }

  if (event.type === EventType.TurnJoined) {
    return event.turnId;
  }

  return undefined;
}
