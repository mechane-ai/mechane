import { canRetainResult } from '@mechane/console-data';
import type { CanonicalCollectionOptions, ConsoleData, ReadReceipt, ReadRequest } from '@mechane/console-data';
import { eq, findProblems, inArray, useLiveQuery } from '@tanstack/react-db';
import type { HealthNode } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ResourceState } from './resource.tsx';

type KeyedRecord = { readonly key: string };

/** Subscribes to acquired records for a bounded key set; undefined disables demand. */
function useCanonicalRows<Row extends KeyedRecord>(
  data: ConsoleData,
  collection: CanonicalCollectionOptions<Row>,
  keys: ReadonlyArray<string> | undefined,
) {
  return useLiveQuery({
    client: data.db,
    // Explicit identity lets native observers switch clients without retaining claims on the previous source objects.
    queryKey: ['console-records', data.scope, collection.id, keys ?? null],
    query: (builder) =>
      keys === undefined
        ? undefined
        : builder.from({ record: collection }).where(({ record }) => inArray(record.key, [...keys])),
  });
}

function orderedRows<Row extends { readonly key: unknown }>(
  rows: ReadonlyArray<Row>,
  keys: ReadonlyArray<string> | undefined,
): ReadonlyArray<Row> | undefined {
  if (keys === undefined) {
    return undefined;
  }

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const ordered = keys.map((key) => byKey.get(key));

  return ordered.every((row) => row !== undefined) ? ordered : undefined;
}

function useReadReceipt(data: ConsoleData, request: ReadRequest | undefined, isActive = true) {
  const requestId = request?.id;

  const query = useLiveQuery({
    client: data.db,
    queryKey: ['console-read', data.scope, request?.id ?? null],
    query: (builder) =>
      request === undefined
        ? undefined
        : builder
            .from({ read: data.collections.reads })
            .where(({ read }) => eq(read.id, request.id))
            .findOne(),
  });

  const subscribe = useCallback(
    (notify: () => void) =>
      requestId === undefined || !isActive ? () => undefined : data.subscribeReadStatus(requestId, notify),
    [data, requestId, isActive],
  );

  const status = useSyncExternalStore(
    subscribe,
    () => (request === undefined ? undefined : data.readStatus(request)),
    () => undefined,
  );

  const revocation = useSyncExternalStore(
    subscribe,
    () => (request === undefined ? undefined : data.readRevocation(request)),
    () => undefined,
  );

  return { receipt: query.data, status, revocation, query };
}

type ReadObservation = ReturnType<typeof useReadReceipt>;

type ReadQuery = {
  readonly isReady: boolean;
  /** Absent while the read is disabled. */
  readonly health: HealthNode | undefined;
  /** Absent while the read is disabled. */
  readonly collection: { readonly reload: () => Promise<void> } | undefined;
};

type ReadStateOptions<Value> = {
  readonly data: ConsoleData;
  /** Undefined disables this read while another view owns the visible demand. */
  readonly request: ReadRequest | undefined;
  /** Absent keeps network demand active; false retains local data without polling or repair. */
  readonly isActive?: boolean;
  readonly observation: ReadObservation;
  /** Undefined means the current receipt does not yet have a complete compatible projection. */
  readonly value: Value | undefined;
  readonly records: ReadonlyArray<ReadQuery>;
};

function useReadState<Value>({
  data,
  request,
  isActive = true,
  observation,
  value,
  records,
}: ReadStateOptions<Value>): ResourceState<Value> {
  const [lastComplete, setLastComplete] = useState<{
    readonly data: ConsoleData;
    readonly id: ReadRequest['id'];
    readonly value: Value;
  }>();

  const { status, revocation, receipt, query } = observation;
  const queries = [query, ...records];
  const problems = records.flatMap((read) => (read.health === undefined ? [] : findProblems(read.health)));
  const firstProblem = problems[0];
  // The shared receipt source also reports failures from other read demands; only this query's error belongs here.
  const queryProblem = query.health?.error ?? firstProblem?.error ?? firstProblem?.failureReason;
  const localError = queryProblem?.cause ?? queryProblem;
  const isRevoked = revocation !== undefined;
  const error = revocation ?? status?.error ?? localError;
  const hasFailed = error !== null && error !== undefined;
  const canRetain = !isRevoked && (!hasFailed || canRetainResult(error));
  const isRefreshing = status?.fetchStatus === 'fetching' || queries.some((read) => read.health?.reloading === true);
  const hasSameOwner = lastComplete?.data === data && lastComplete.id === request?.id;
  const ready = canRetain ? (value ?? (hasSameOwner ? lastComplete.value : undefined)) : undefined;

  if (canRetain && value !== undefined && request !== undefined) {
    if (!hasSameOwner || lastComplete.value !== value) {
      setLastComplete({ data, id: request.id, value });
    }
  } else if ((!canRetain || !hasSameOwner) && lastComplete !== undefined) {
    setLastComplete(undefined);
  }

  const hasIncompleteReceipt = receipt !== undefined && records.every((read) => read.isReady) && value === undefined;
  const canRepair = isActive && !isRevoked;
  const needsRepair = canRepair && request !== undefined && hasIncompleteReceipt;

  useEffect(() => {
    if (needsRepair && !isRefreshing && !hasFailed) {
      void Promise.allSettled([data.refresh(request)]);
    }
  }, [data, hasFailed, isRefreshing, needsRepair, request]);

  function retry(): void {
    if (request !== undefined) {
      void Promise.allSettled([reload(request)]);
    }
  }

  async function reload(selected: ReadRequest): Promise<void> {
    await data.refresh(selected);
    await Promise.all(
      queries.flatMap((read) =>
        read.health?.hasErrors === true && read.collection !== undefined ? [read.collection.reload()] : [],
      ),
    );
  }

  if (ready !== undefined) {
    return {
      kind: 'ready',
      value: ready,
      refresh: hasFailed
        ? { kind: 'failed', problem: error, retry, isRetrying: isRefreshing }
        : { kind: isRefreshing ? 'pending' : 'idle' },
    };
  }

  return hasFailed || isRevoked
    ? { kind: 'failed', problem: error, retry, isRetrying: isRefreshing }
    : { kind: 'pending' };
}

type CanonicalQueryRow<Row extends KeyedRecord> = NonNullable<ReturnType<typeof useCanonicalRows<Row>>['data']>[number];

type CollectionReadOptions<Row extends KeyedRecord, Value> = {
  readonly data: ConsoleData;
  /** Undefined keeps the read inactive without changing hook ownership. */
  readonly request: ReadRequest | undefined;
  /** Absent keeps network demand active; false retains the query without a network observer. */
  readonly isActive?: boolean;
  readonly collection: CanonicalCollectionOptions<Row>;
  /** Returns undefined while domain-specific record dependencies are incomplete or incompatible. */
  readonly project: (rows: ReadonlyArray<CanonicalQueryRow<Row>>, receipt: ReadReceipt) => Value | undefined;
};

export function useCollectionRead<Row extends KeyedRecord, Value>({
  data,
  request,
  isActive = true,
  collection,
  project,
}: CollectionReadOptions<Row, Value>): ResourceState<Value> {
  const observation = useReadReceipt(data, request, isActive);
  const { receipt } = observation;
  const query = useCanonicalRows(data, collection, receipt?.keys);

  const value = useMemo(() => {
    const rows = orderedRows(query.data ?? [], receipt?.keys);

    return rows === undefined || receipt === undefined ? undefined : project(rows, receipt);
  }, [project, query.data, receipt]);

  return useReadState({ data, request, isActive, observation, value, records: [query] });
}

/** Session text and membership live only in the admitted tab's reader. */
export function useManagedEvents(data: ConsoleData, request: ReadRequest<'sessionEvents'>) {
  const observation = useReadReceipt(data, request);
  const history = data.managed.history(request);

  const value = useMemo(
    () => (history === undefined ? undefined : { items: history.items, next: history.nextPage }),
    [history],
  );

  return useReadState({ data, request, observation, value, records: [] });
}

/** Retains the last confirmed agent attention across transient refresh failures. */
export function useAgentAttention(data: ConsoleData, agentId: string) {
  const request = useMemo(() => data.reads.attention(agentId), [data, agentId]);
  const observation = useReadReceipt(data, request);
  const value = data.managed.attention(request);
  const state = useReadState({ data, request, observation, value, records: [] });

  return state.kind === 'ready' ? state.value : undefined;
}
