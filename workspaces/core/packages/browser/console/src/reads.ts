import {
  canRetainResult,
  decodeAllowance,
  decodeEnvironmentProcess,
  decodeEnvironmentProcessDetails,
  decodeEvent,
  decodeEvidenceArtifact,
  decodeMech,
  decodeMechSummary,
  decodeTrace,
  decodeTurn,
  recordKey,
} from '@mechane/console-data';
import type {
  AllowanceRow,
  CanonicalCollectionOptions,
  ConsoleData,
  EnvironmentProcessDetailsRow,
  EnvironmentProcessRow,
  EventRow,
  EvidenceArtifactRow,
  MechSummaryRow,
  ReadReceipt,
  ReadRequest,
  TurnRow,
} from '@mechane/console-data';
import type { Allowance, EventPage, MechPage, TurnPage } from '@mechane/protocol';
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

function useCollectionRead<Row extends KeyedRecord, Value>({
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

function mechPage(rows: ReadonlyArray<MechSummaryRow>, receipt: ReadReceipt): MechPage {
  return { mechs: rows.map(decodeMechSummary), hasMore: receipt.hasMore === true };
}

function eventPage(rows: ReadonlyArray<EventRow>, receipt: ReadReceipt): EventPage {
  return { events: rows.map(decodeEvent), hasMore: receipt.hasMore === true };
}

function turnPage(rows: ReadonlyArray<TurnRow>, receipt: ReadReceipt): TurnPage {
  return { turns: rows.map(decodeTurn), hasMore: receipt.hasMore === true };
}

function allowanceValue(rows: ReadonlyArray<AllowanceRow>): Allowance | undefined {
  const row = rows[0];

  return row === undefined ? undefined : decodeAllowance(row);
}

function evidencePage(rows: ReadonlyArray<EvidenceArtifactRow>, receipt: ReadReceipt) {
  return { artifacts: rows.map(decodeEvidenceArtifact), hasMore: receipt.hasMore === true };
}

function evidenceArtifact(rows: ReadonlyArray<EvidenceArtifactRow>) {
  const row = rows[0];

  return row === undefined ? undefined : decodeEvidenceArtifact(row);
}

function environmentProcesses(rows: ReadonlyArray<EnvironmentProcessRow>) {
  return rows.map(decodeEnvironmentProcess);
}

function environmentProcessDetails(rows: ReadonlyArray<EnvironmentProcessDetailsRow>) {
  const row = rows[0];

  return row === undefined ? undefined : decodeEnvironmentProcessDetails(row);
}

/** Projects exact-machine process observations while allowing covered views to release network demand. */
export function useEnvironmentProcesses(
  data: ConsoleData,
  request: ReadRequest<'environmentProcesses'> | undefined,
  isActive = true,
) {
  return useCollectionRead({
    data,
    request,
    isActive,
    collection: data.collections.environmentProcesses,
    project: environmentProcesses,
  });
}

/** Reads bounded output only while its exact process panel is visible. */
export function useEnvironmentProcess(
  data: ConsoleData,
  request: ReadRequest<'environmentProcess'>,
  isActive: boolean,
) {
  return useCollectionRead({
    data,
    request,
    isActive,
    collection: data.collections.environmentProcessDetails,
    project: environmentProcessDetails,
  });
}

/** Projects the admitted run's paginated capture metadata from canonical artifact records. */
export function useEvidence(data: ConsoleData, request: ReadRequest<'evidence'>) {
  return useCollectionRead({ data, request, collection: data.collections.evidenceArtifacts, project: evidencePage });
}

/** Reads one capture without retaining its projection after workspace access is revoked. */
export function useEvidenceArtifact(data: ConsoleData, request: ReadRequest<'evidenceArtifact'> | undefined) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.evidenceArtifacts,
    project: evidenceArtifact,
  });
}

/** Keeps the server's mech order and waits for every summary named by the page receipt. */
export function useMechs(data: ConsoleData, request: ReadRequest<'mechs'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.mechs, project: mechPage });
}

/** Resolves activity and run history pages against the same canonical events. */
export function useEvents(data: ConsoleData, request: ReadRequest<'events' | 'turnEvents'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.events, project: eventPage });
}

type EventWindow = { readonly sequences: ReadonlyArray<number>; readonly hasMore: boolean };

/** Retains the visible event identities and pagination boundary without copying records. */
export function eventWindow(page: EventPage): EventWindow {
  return { sequences: page.events.map((event) => event.sequence), hasMore: page.hasMore };
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

/** Shares canonical turns with trace views while retaining the run page's server order. */
export function useTurns(data: ConsoleData, request: ReadRequest<'turns'> | undefined) {
  return useCollectionRead({ data, request, collection: data.collections.turns, project: turnPage });
}

/** Keeps allowance readiness independent of the mech list's primary content. */
export function useAllowance(data: ConsoleData, request: ReadRequest<'allowance'>) {
  return useCollectionRead({ data, request, collection: data.collections.allowance, project: allowanceValue });
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
