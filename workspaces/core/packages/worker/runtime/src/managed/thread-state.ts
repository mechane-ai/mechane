import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { appendManagedEvent } from './event-log/write.ts';
import type { ManagedEvent, ManagedSessionState, ManagedWireObject } from './protocol.ts';
import { DirtySessions, sessionState } from './scheduler.ts';
import { activeMillis, liveThreadIds, publicThread, requiredThread, threadRecords } from './thread-records.ts';
import type { ThreadRecord } from './thread-records.ts';
import { queueSessionUsage, queueThreadUsage } from './usage-projection.ts';

const Aggregate = defineDocFamily({
  kind: 'managed.thread-aggregate',
  version: 1,
  checkpointWhen: () => true,
  scope: 'session',
  family: true,
  initial: (_seed: null) => ({ status: '', reason: '' }),
});

export async function readManagedSessionState(transaction: Tx, sessionId: string): Promise<ManagedSessionState> {
  const session = await sessionState(transaction, sessionId);
  const ids = await liveThreadIds(sessionId).allInTransaction(transaction);
  const live = await Promise.all(ids.map(async (id) => await requiredThread(transaction, sessionId, id)));
  const primary = await requiredThread(transaction, sessionId, session.threadId);
  const base = { primary_thread_id: primary.id };

  if (live.some((record) => record.status === 'running')) {
    return { ...base, status: 'running', stop_reason: null };
  }

  if (live.length === 0 || session.isArchived) {
    return { ...base, status: 'terminated', stop_reason: null };
  }

  const blocked = new Set(
    live.flatMap((record) => {
      const events = record.reason?.['event_ids'];

      if (record.reason?.['type'] !== 'requires_action' || !Array.isArray(events)) {
        return [];
      }

      return events.filter((event) => typeof event === 'string');
    }),
  );

  if (blocked.size > 0) {
    return { ...base, status: 'idle', stop_reason: { type: 'requires_action', event_ids: [...blocked].toSorted() } };
  }

  if (session.isBudgetReached || live.some((record) => record.reason?.['type'] === 'budget_reached')) {
    return { ...base, status: 'idle', stop_reason: { type: 'budget_reached' } };
  }

  return { ...base, status: 'idle', stop_reason: primary.reason ?? { type: 'end_turn' } };
}

function idleFields(status: string, reason: ManagedWireObject | null) {
  if (status === 'idle') {
    return { stop_details: null, stop_reason: reason };
  }

  return {};
}

export async function reconcileManagedSessionStatus(transaction: Tx, sessionId: string, isForced = false) {
  const next = await readManagedSessionState(transaction, sessionId);
  const aggregate = await transaction.doc(Aggregate, sessionId, null);
  const reason = JSON.stringify(next.stop_reason);

  if (!isForced && aggregate.status === next.status && aggregate.reason === reason) {
    return false;
  }

  aggregate.status = next.status;
  aggregate.reason = reason;
  const fields = idleFields(next.status, next.stop_reason);
  const session = await sessionState(transaction, sessionId);

  if (next.status === 'idle' && session.publicSessionId === sessionId) {
    await queueSessionUsage(transaction, sessionId);
  }

  await appendManagedEvent(transaction, { sessionId }, { type: `session.status_${next.status}`, ...fields });
  await DirtySessions.put(transaction, sessionId, sessionId);

  return next.status === 'idle';
}

type Transition = {
  readonly sessionId: string;
  readonly threadId: string;
  readonly status: 'running' | 'idle' | 'terminated';
  readonly stopReason?: ManagedWireObject | null;
  readonly isArchived?: boolean;
  readonly usage?: ManagedWireObject | null;
  readonly isForced?: boolean;
  readonly onEvent?: (event: ManagedEvent) => void;
};

function reasonFor(change: Transition) {
  if (change.status !== 'idle') {
    return null;
  }

  return change.stopReason ?? { type: 'end_turn' };
}

function createTransition(previous: ThreadRecord, change: Transition, reason: ManagedWireObject | null): ThreadRecord {
  const now = Math.max(Date.now(), previous.updatedAt);

  const record = {
    ...previous,
    status: change.status,
    reason,
    activeMs: activeMillis(previous, now),
    updatedAt: now,
    hasTransitioned: true,
    usage: change.usage ?? previous.usage,
  };

  if (change.status === 'running') {
    record.startedAt ??= now;
  }

  if (change.isArchived === true) {
    record.archivedAt ??= now;
  }

  return record;
}

export async function transitionManagedThread(transaction: Tx, change: Transition) {
  const previous = await requiredThread(transaction, change.sessionId, change.threadId);

  if (previous.archivedAt !== null || (previous.status === 'terminated' && change.isArchived !== true)) {
    return publicThread(previous);
  }

  const reason = reasonFor(change);
  const unchanged = previous.status === change.status && JSON.stringify(previous.reason) === JSON.stringify(reason);
  const hasStatusEvent = !unchanged || change.isForced === true;
  const hasRecordChanges = hasStatusEvent || change.isArchived === true || change.usage !== undefined;

  if (!hasRecordChanges) {
    await reconcileManagedSessionStatus(transaction, change.sessionId);

    return publicThread(previous);
  }

  const record = createTransition(previous, change, reason);
  const session = await sessionState(transaction, change.sessionId);
  const isPublicSession = session.publicSessionId === change.sessionId;

  const scope = {
    localId: change.sessionId,
    sessionId: session.publicSessionId,
    threadId: record.id,
    at: record.updatedAt,
  };

  if (record.id === session.threadId && (record.status === 'running') !== (previous.status === 'running')) {
    await queueThreadUsage(transaction, scope, record.status === 'running');
  }

  if (isPublicSession && record.status === 'idle') {
    const usagePendingId = await queueThreadUsage(transaction, scope);

    await threadRecords(change.sessionId).put(transaction, record.id, { ...record, usagePendingId });
  } else {
    await threadRecords(change.sessionId).put(transaction, record.id, record);
  }

  if (record.status === 'terminated') {
    await liveThreadIds(change.sessionId).remove(transaction, record.id);
  }

  const threadAtCap = record.status === 'idle' && (session.isBudgetReached || reason?.['type'] === 'budget_reached');
  const publishesThreadStatus = record.parentId !== null || (threadAtCap && isPublicSession);

  if (publishesThreadStatus && hasStatusEvent) {
    const idle = idleFields(record.status, reason);

    const event = await appendManagedEvent(
      transaction,
      { sessionId: record.sessionId, threadId: record.id },
      {
        type: `session.thread_status_${record.status}`,
        session_thread_id: record.id,
        agent_name: record.agent['name'],
        ...idle,
      },
    );

    change.onEvent?.(event);
  }

  const emittedIdle = await reconcileManagedSessionStatus(transaction, change.sessionId, change.isForced);
  const hasReachedBudget = !unchanged && reason?.['type'] === 'budget_reached';

  if (!emittedIdle && isPublicSession && hasReachedBudget) {
    await queueSessionUsage(transaction, change.sessionId);
  }

  return publicThread(record);
}
