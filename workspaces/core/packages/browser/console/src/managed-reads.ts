import { decodeSessionEvidenceArtifact } from '@mechane/console-data';
import type {
  ConsoleData,
  ManagedAgent,
  ManagedEnvironment,
  ManagedSession,
  ManagedThread,
  ReadReceipt,
  ReadRequest,
  SessionEvidenceRow,
} from '@mechane/console-data';
import { useCollectionRead } from './reads.ts';

function single<Value>(rows: ReadonlyArray<{ readonly value: Value }>): Value | undefined {
  return rows[0]?.value;
}

function page<Value>(rows: ReadonlyArray<{ readonly value: Value }>, receipt: ReadReceipt) {
  return { items: rows.map((row) => row.value), next: receipt.nextPage ?? null };
}

export function useManagedAgents(data: ConsoleData, request: ReadRequest<'agents'>) {
  return useCollectionRead({ data, request, collection: data.collections.managedAgents, project: page<ManagedAgent> });
}

export function useManagedAgent(data: ConsoleData, request: ReadRequest<'agent'>) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.managedAgents,
    project: single<ManagedAgent>,
  });
}

export function useManagedSessions(data: ConsoleData, request: ReadRequest<'sessions'>) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.managedSessions,
    project: page<ManagedSession>,
  });
}

export function useManagedSession(data: ConsoleData, request: ReadRequest<'session'>) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.managedSessions,
    project: single<ManagedSession>,
  });
}

export function useManagedEnvironments(data: ConsoleData, request: ReadRequest<'managedEnvironments'>) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.managedEnvironments,
    project: page<ManagedEnvironment>,
  });
}

export function useManagedThreads(data: ConsoleData, request: ReadRequest<'threads'>) {
  return useCollectionRead({
    data,
    request,
    collection: data.collections.managedThreads,
    project: page<ManagedThread>,
  });
}

function capture(rows: ReadonlyArray<SessionEvidenceRow>) {
  const row = rows[0];

  return row === undefined ? undefined : decodeSessionEvidenceArtifact(row);
}

function captures(rows: ReadonlyArray<SessionEvidenceRow>, receipt: ReadReceipt) {
  return { items: rows.map(decodeSessionEvidenceArtifact), next: receipt.nextPage ?? null };
}

export function useSessionEvidence(data: ConsoleData, request: ReadRequest<'sessionEvidence'>) {
  return useCollectionRead({ data, request, collection: data.collections.sessionEvidence, project: captures });
}

export function useSessionArtifact(data: ConsoleData, request: ReadRequest<'sessionArtifact'>) {
  return useCollectionRead({ data, request, collection: data.collections.sessionEvidence, project: capture });
}
