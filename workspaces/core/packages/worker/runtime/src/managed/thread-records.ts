import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { actorRecordCollection, actorRecordSet } from '../actor/record-store.ts';
import { failManagedRequest } from './failure.ts';
import { ManagedSessionStatus, ManagedWireObject } from './protocol.ts';
import type { ManagedSessionThread } from './protocol.ts';

const Thread = Schema.Struct({
  id: Schema.String,
  sessionId: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  agent: ManagedWireObject,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  archivedAt: Schema.NullOr(Schema.Number),
  startedAt: Schema.NullOr(Schema.Number),
  status: ManagedSessionStatus,
  reason: Schema.NullOr(ManagedWireObject),
  activeMs: Schema.Number,
  hasTransitioned: Schema.Boolean,
  usage: Schema.NullOr(ManagedWireObject),
  usagePendingId: Schema.optional(Schema.NullOr(Schema.String)),
});

export type ThreadRecord = typeof Thread.Type;

export function threadRecords(sessionId: string) {
  return actorRecordCollection(JSON.stringify(['managed.threads', sessionId]), Thread);
}

export function liveThreadIds(sessionId: string) {
  return actorRecordSet(JSON.stringify(['managed.live-threads', sessionId]));
}

export function threadNotFound(): never {
  failManagedRequest(HttpStatusCode.NotFound, 'Session thread not found');
}

export async function requiredThread(transaction: Tx, sessionId: string, threadId: string): Promise<ThreadRecord> {
  const record = await threadRecords(sessionId).read(transaction, threadId);

  if (record === undefined) {
    return threadNotFound();
  }

  return record;
}

export async function readManagedThread(
  transaction: Tx,
  sessionId: string,
  threadId: string,
): Promise<ManagedSessionThread> {
  return publicThread(await requiredThread(transaction, sessionId, threadId));
}

function elapsed(record: ThreadRecord, until: number) {
  if (record.startedAt === null || record.status !== 'running') {
    return record.activeMs;
  }

  return record.activeMs + Math.max(0, until - record.updatedAt);
}

export function activeMillis(record: ThreadRecord, now: number) {
  return elapsed(record, Math.max(record.updatedAt, now));
}

const MILLISECONDS_PER_SECOND = 1000;

function seconds(milliseconds: number): number {
  return Math.max(0, milliseconds) / MILLISECONDS_PER_SECOND;
}

function asIso(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Date(value).toISOString();
}

function statistics(record: ThreadRecord, now: number, activeSeconds: number) {
  if (!record.hasTransitioned) {
    return null;
  }

  const stats = { active_seconds: activeSeconds, duration_seconds: seconds(now - record.createdAt) };

  if (record.parentId !== null) {
    return { ...stats, startup_seconds: 0 };
  }

  if (record.startedAt === null) {
    return stats;
  }

  return { ...stats, startup_seconds: seconds(record.startedAt - record.createdAt) };
}

function observedActiveSeconds(record: ThreadRecord, now: number): number {
  const recorded = record.usage?.['active_seconds'];

  if (record.status !== 'running' && typeof recorded === 'number') {
    return recorded;
  }

  return seconds(activeMillis(record, now));
}

export function publicThread(record: ThreadRecord): ManagedSessionThread {
  const now = record.archivedAt ?? Date.now();
  const runningSeconds = observedActiveSeconds(record, now);
  let usage = record.usage;

  if (usage !== null) {
    usage = { ...usage, active_seconds: runningSeconds };
  }

  return {
    type: 'session_thread',
    id: record.id,
    agent: record.agent,
    archived_at: asIso(record.archivedAt),
    created_at: new Date(record.createdAt).toISOString(),
    parent_thread_id: record.parentId,
    session_id: record.sessionId,
    stats: statistics(record, now, runningSeconds),
    status: record.status,
    updated_at: new Date(record.updatedAt).toISOString(),
    usage,
    workflow_run_id: null,
  };
}
