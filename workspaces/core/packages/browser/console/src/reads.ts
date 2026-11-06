import {
  canRetainResult,
  decodeAllowance,
  decodeEvent,
  decodeMech,
  decodeMechSummary,
  decodeMemory,
  decodeSlackBinding,
  decodeSlackDelivery,
  decodeThread,
  decodeTrace,
  decodeTurn,
  recordKey,
} from '@mechane/console-data';
import type {
  AllowanceRow,
  CanonicalCollectionOptions,
  ConsoleData,
  EventRow,
  MechSummaryRow,
  MemoryRow,
  ReadReceipt,
  ReadRequest,
  SlackBindingRow,
  SlackDeliveryRow,
  ThreadRow,
  TurnRow,
} from '@mechane/console-data';
import type { Allowance, EventPage, MechPage, MemoryList, ThreadPage, TurnPage } from '@mechane/protocol';
import { eq, findProblems, inArray, useLiveQuery } from '@tanstack/react-db';
import type { HealthNode } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ResourceState } from './resource.tsx';

type KeyedRecord = { readonly key: string };

/** Subscribes to acquired records for a bounded key set; undefined disables demand. */
export function useCanonicalRows<Row extends KeyedRecord>(
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

function useReadReceipt(data: ConsoleData, request: ReadRequest | undefined) {
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
    (notify: () => void) => (request === undefined ? () => undefined : data.subscribeReadStatus(request, notify)),
    [data, request],
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
  readonly observation: ReadObservation;
  /** Undefined means the current receipt does not yet have a complete compatible projection. */
  readonly value: Value | undefined;
  readonly records: ReadonlyArray<ReadQuery>;
};

function useReadState<Value>({
  data,
  request,
  observation,
  value,
  records,
}: ReadStateOptions<Value>): ResourceState<Value> {
  const [lastComplete, setLastComplete] = useState<{
    readonly scope: string;
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
  const hasSameOwner = lastComplete?.scope === data.scope && lastComplete.id === request?.id;
  const ready = canRetain ? (value ?? (hasSameOwner ? lastComplete.value : undefined)) : undefined;

  if (canRetain && value !== undefined && request !== undefined) {
    if (!hasSameOwner || lastComplete.value !== value) {
      setLastComplete({ scope: data.scope, id: request.id, value });
    }
  } else if ((!canRetain || !hasSameOwner) && lastComplete !== undefined) {
    setLastComplete(undefined);
  }

  const hasIncompleteReceipt = receipt !== undefined && records.every((read) => read.isReady) && value === undefined;
  const needsRepair = request !== undefined && hasIncompleteReceipt && !isRevoked;

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
  readonly collection: CanonicalCollectionOptions<Row>;
  /** Returns undefined while domain-specific record dependencies are incomplete or incompatible. */
  readonly project: (rows: ReadonlyArray<CanonicalQueryRow<Row>>, receipt: ReadReceipt) => Value | undefined;
};

function useCollectionRead<Row extends KeyedRecord, Value>({
  data,
  request,
  collection,
  project,
}: CollectionReadOptions<Row, Value>): ResourceState<Value> {
  const observation = useReadReceipt(data, request);
  const { receipt } = observation;
  const query = useCanonicalRows(data, collection, receipt?.keys);

  const value = useMemo(() => {
    const rows = orderedRows(query.data ?? [], receipt?.keys);

    return rows === undefined || receipt === undefined ? undefined : project(rows, receipt);
  }, [project, query.data, receipt]);

  return useReadState({ data, request, observation, value, records: [query] });
}

function mechPage(rows: ReadonlyArray<MechSummaryRow>, receipt: ReadReceipt): MechPage {
  return { mechs: rows.map(decodeMechSummary), hasMore: receipt.hasMore === true };
}

function eventPage(rows: ReadonlyArray<EventRow>, receipt: ReadReceipt): EventPage {
  return { events: rows.map(decodeEvent), hasMore: receipt.hasMore === true };
}

function threadPage(rows: ReadonlyArray<ThreadRow>, receipt: ReadReceipt): ThreadPage {
  return { threads: rows.map(decodeThread), hasMore: receipt.hasMore === true };
}

function turnPage(rows: ReadonlyArray<TurnRow>, receipt: ReadReceipt): TurnPage {
  return { turns: rows.map(decodeTurn), hasMore: receipt.hasMore === true };
}

function memoryPage(rows: ReadonlyArray<MemoryRow>): MemoryList {
  return { memories: rows.map(decodeMemory) };
}

function allowanceValue(rows: ReadonlyArray<AllowanceRow>): Allowance | undefined {
  const row = rows[0];

  return row === undefined ? undefined : decodeAllowance(row);
}

function slackBindings(rows: ReadonlyArray<SlackBindingRow>) {
  return { bindings: rows.map(decodeSlackBinding) };
}

function slackDeliveries(rows: ReadonlyArray<SlackDeliveryRow>) {
  return { deliveries: rows.map(decodeSlackDelivery) };
}

/** Keeps the server's mech order and waits for every summary named by the page receipt. */
export function useMechs(data: ConsoleData, request: ReadRequest<'mechs'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.mechs, project: mechPage });
}

/** Resolves conversation and run history pages against the same canonical events. */
export function useEvents(data: ConsoleData, request: ReadRequest<'events' | 'turnEvents'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.events, project: eventPage });
}

type EventWindow = { readonly sequences: ReadonlyArray<number>; readonly hasMore: boolean };

/** Retains the visible event identities and pagination boundary without copying records. */
export function eventWindow(page: EventPage): EventWindow {
  return { sequences: page.events.map((event) => event.sequence), hasMore: page.hasMore };
}

/** Distinguishes a changed visible range from updates to records within that range. */
export function sameEventWindow(left: EventWindow, right: EventWindow): boolean {
  return (
    left.hasMore === right.hasMore &&
    left.sequences.length === right.sequences.length &&
    left.sequences.every((sequence, index) => sequence === right.sequences[index])
  );
}

/** Preserves a reader's chosen event range while its exact historical demand repairs missing records. */
export function useEventWindow(
  data: ConsoleData,
  request: ReadRequest<'events'>,
  window: EventWindow,
): ResourceState<EventPage> {
  const observation = useReadReceipt(data, request);

  const keys = useMemo(
    () => window.sequences.map((sequence) => recordKey(request.mechId, sequence)),
    [request.mechId, window.sequences],
  );

  const query = useCanonicalRows(data, data.collections.events, keys);

  const value = useMemo(() => {
    const rows = orderedRows(query.data ?? [], keys);

    return rows === undefined ? undefined : { events: rows.map(decodeEvent), hasMore: window.hasMore };
  }, [keys, query.data, window.hasMore]);

  return useReadState({ data, request, observation, value, records: [query] });
}

/** Publishes a work page only when every thread referenced by its receipt is available. */
export function useThreads(data: ConsoleData, request: ReadRequest<'threads'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.threads, project: threadPage });
}

/** Shares canonical turns with trace views while retaining the run page's server order. */
export function useTurns(data: ConsoleData, request: ReadRequest<'turns'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.turns, project: turnPage });
}

/** Resolves the complete bounded memory read, including an authoritative empty result. */
export function useMemories(data: ConsoleData, request: ReadRequest<'memories'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.memories, project: memoryPage });
}

/** Keeps allowance readiness independent of the mech list's primary content. */
export function useAllowance(data: ConsoleData, request: ReadRequest<'allowance'>) {
  return useCollectionRead({ data, request, collection: data.collections.allowance, project: allowanceValue });
}

/** Resolves workspace bindings before the caller filters them to one mech. */
export function useSlackBindings(data: ConsoleData, request: ReadRequest<'slackBindings'>) {
  return useCollectionRead({ data, request, collection: data.collections.slackBindings, project: slackBindings });
}

/** Preserves the bounded delivery response's order without implying older history is complete. */
export function useSlackDeliveries(data: ConsoleData, request: ReadRequest<'slackDeliveries'>) {
  return useCollectionRead({ data, request, collection: data.collections.slackDeliveries, project: slackDeliveries });
}

/** Requires matching summary and definition revisions before replacing a complete authorized mech view. */
export function useMech(data: ConsoleData, request: ReadRequest<'mech'> | undefined) {
  const observation = useReadReceipt(data, request);
  const { receipt } = observation;
  const summaries = useCanonicalRows(data, data.collections.mechs, receipt?.keys);
  const definitions = useCanonicalRows(data, data.collections.mechDefinitions, receipt?.keys);

  const value = useMemo(() => {
    const summary = orderedRows(summaries.data ?? [], receipt?.keys)?.[0];
    const definition = orderedRows(definitions.data ?? [], receipt?.keys)?.[0];

    if (summary === undefined || definition === undefined || summary.value.revision !== definition.value.revision) {
      return;
    }

    return decodeMech(summary, definition);
  }, [definitions.data, receipt, summaries.data]);

  return useReadState({ data, request, observation, value, records: [summaries, definitions] });
}

/** Combines trace evidence with the canonical turn also used by run lists and message receipts. */
export function useTrace(data: ConsoleData, request: ReadRequest<'trace'> | undefined) {
  const observation = useReadReceipt(data, request);
  const { receipt } = observation;
  const turns = useCanonicalRows(data, data.collections.turns, receipt?.keys);
  const evidence = useCanonicalRows(data, data.collections.traceEvidence, receipt?.keys);

  const value = useMemo(() => {
    const turn = orderedRows(turns.data ?? [], receipt?.keys)?.[0];
    const detail = orderedRows(evidence.data ?? [], receipt?.keys)?.[0];

    return turn === undefined || detail === undefined ? undefined : decodeTrace(turn, detail);
  }, [evidence.data, receipt, turns.data]);

  return useReadState({ data, request, observation, value, records: [turns, evidence] });
}
