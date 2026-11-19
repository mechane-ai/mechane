import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { fingerprint } from '../../actor/state.ts';
import { failManagedRequest } from '../failure.ts';
import type { ManagedEvent } from '../protocol.ts';
import { DirtySessions } from '../scheduler.ts';
import { crossPosts, EventClock, indexedEvents, stableEvents } from './collections.ts';
import { sessionEvents } from './payload-storage.ts';
import type { ManagedEventRow } from './payload-storage.ts';
import { indexWorkerEvent } from './worker-feed.ts';

type Fields = Readonly<Record<string, unknown>> & { readonly type: string };

type EventScope = {
  readonly sessionId: string;
  readonly threadId?: string | null | undefined;
  readonly stableKey?: string | undefined;
};

const EVENT_ID_HEX_CHARACTERS = 32;

export async function managedStableEventId(sessionId: string, threadId: string | null, key: string): Promise<string> {
  const digest = await fingerprint([sessionId, threadId, key]);

  return `sevt_${digest.slice(0, EVENT_ID_HEX_CHARACTERS)}`;
}

function pending(type: string): boolean {
  switch (type) {
    case 'user.message':
    case 'system.message':
    case 'user.tool_confirmation':
    case 'user.interrupt':
      return true;
    default:
      return false;
  }
}

async function stamp(transaction: Tx, sessionId: string, isPending: boolean): Promise<string | null> {
  const clock = await transaction.doc(EventClock, sessionId, null);
  clock.sequence += 1;

  if (isPending) {
    return null;
  }

  clock.processedTime = Math.max(clock.processedTime, Date.now());

  return new Date(clock.processedTime).toISOString();
}

async function index(transaction: Tx, scope: EventScope, event: ManagedEvent): Promise<void> {
  const { sessionId, threadId: view = null } = scope;
  const waiting = indexedEvents(sessionId, view, 'pending');

  if (event.processed_at === null) {
    await waiting.put(transaction, event.id, event.id);

    return;
  }

  await waiting.remove(transaction, event.id);
  await indexedEvents(sessionId, view, 'processed').put(transaction, event.id, event.id);
}

async function indexRow(transaction: Tx, sessionId: string, row: ManagedEventRow): Promise<void> {
  await indexWorkerEvent(transaction, sessionId, row.event);
  await index(transaction, { sessionId, threadId: row.threadId }, row.event);

  if (row.threadId !== null && crossPosts(row.event)) {
    await index(transaction, { sessionId }, row.event);
  }
}

async function write(transaction: Tx, sessionId: string, row: ManagedEventRow): Promise<void> {
  await sessionEvents(sessionId).put(transaction, row.event.id, row);
  await indexRow(transaction, sessionId, row);
}

export async function appendManagedEvent(
  transaction: Tx,
  { sessionId, threadId = null, stableKey }: EventScope,
  fields: Fields,
): Promise<ManagedEvent> {
  if (Object.hasOwn(fields, 'id') || Object.hasOwn(fields, 'processed_at')) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Event identity and processing time are assigned by the session');
  }

  async function insert(id: string) {
    const processed = await stamp(transaction, sessionId, pending(fields.type));
    const event: ManagedEvent = { ...fields, id, type: fields.type, processed_at: processed };

    await write(transaction, sessionId, { event, threadId });

    return event;
  }

  if (stableKey === undefined) {
    return await insert(`sevt_${crypto.randomUUID().replaceAll('-', '')}`);
  }

  const receipts = stableEvents(sessionId);
  const digest = await fingerprint({ threadId, fields });
  const key = JSON.stringify(['local', threadId, stableKey]);
  const previous = await receipts.read(transaction, key);

  if (previous !== undefined) {
    if (previous.digest !== digest) {
      failManagedRequest(HttpStatusCode.BadRequest, 'The event receipt already identifies different content');
    }

    const row = await sessionEvents(sessionId).describe(transaction, previous.id);

    if (row === undefined) {
      throw new Error('A managed event receipt points to a missing event');
    }

    return { ...fields, id: previous.id, type: fields.type, processed_at: row.event.processed_at };
  }

  const id = await managedStableEventId(sessionId, threadId, stableKey);
  const event = await insert(id);

  await receipts.put(transaction, key, { id, digest });

  return event;
}

export async function processManagedEvent(transaction: Tx, sessionId: string, id: string): Promise<string> {
  const result = await sessionEvents(sessionId).process(transaction, id, () => stamp(transaction, sessionId, false));

  if (result === undefined) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Unknown session event');
  }

  if (result.changed) {
    await indexRow(transaction, sessionId, result.row);
  }

  const timestamp = result.row.event.processed_at;

  if (timestamp === null) {
    throw new Error('The processed event has no timestamp');
  }

  return timestamp;
}

export async function importManagedThreadEvent(
  transaction: Tx,
  { sessionId, threadId }: { readonly sessionId: string; readonly threadId: string },
  source: ManagedEvent,
): Promise<ManagedEvent> {
  if (
    !source.id.startsWith('sevt_') ||
    source.processed_at === null ||
    !Number.isFinite(Date.parse(source.processed_at))
  ) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Only processed child events can be published');
  }

  const key = JSON.stringify(['child', source.id]);
  const receipts = stableEvents(sessionId);
  const digest = await fingerprint({ threadId, source });
  const existing = await sessionEvents(sessionId).describe(transaction, source.id);

  if (existing !== undefined) {
    const receipt = await receipts.read(transaction, key);

    if (receipt?.digest !== digest || existing.threadId !== threadId) {
      failManagedRequest(HttpStatusCode.Conflict, 'The child event conflicts with a published event');
    }

    return { ...source, processed_at: existing.event.processed_at };
  }

  // Source clocks can differ across identity actors. The session assigns its own processing time on first publication.
  const event = { ...source, processed_at: await stamp(transaction, sessionId, false) };

  await write(transaction, sessionId, { event, threadId });
  await receipts.put(transaction, key, { id: source.id, digest });

  return event;
}

export async function readManagedEvent(
  transaction: Tx,
  sessionId: string,
  id: string,
): Promise<ManagedEvent | undefined> {
  const row = await sessionEvents(sessionId).read(transaction, id);

  return row?.event;
}

export async function managedEventSequence(transaction: Tx, sessionId: string): Promise<number> {
  const clock = await transaction.doc(EventClock, sessionId, null);

  return clock.sequence;
}

export async function markManagedProjection(transaction: Tx, sessionId: string): Promise<void> {
  const clock = await transaction.doc(EventClock, sessionId, null);
  clock.sequence += 1;

  await DirtySessions.put(transaction, sessionId, sessionId);
}
