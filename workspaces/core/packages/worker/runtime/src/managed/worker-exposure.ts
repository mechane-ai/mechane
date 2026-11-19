import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Session, Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { pendingChildCalls } from './delegation/inputs.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { failManagedRequest } from './failure.ts';
import type { ManagedEvent, ManagedWireObject, ManagedWorkerLease } from './protocol.ts';
import { Sessions } from './scheduler.ts';
import { liveThreadIds } from './thread-records.ts';

const workerToolEvents: ReadonlySet<string> = new Set(['agent.tool_use', 'agent.custom_tool_use']);

const Exposure = defineDocFamily<{ readonly isClosed: boolean }, null>({
  kind: 'managed.worker-exposure',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ isClosed: false }),
});

const Calls = defineDocFamily<{ readonly wasSeen: boolean; readonly isAllowed: boolean }, null>({
  kind: 'managed.worker-call-exposure',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ wasSeen: false, isAllowed: false }),
});

function leaseKey({ sessionId, leaseId }: ManagedWorkerLease): string {
  return JSON.stringify([sessionId, leaseId]);
}

function callKey(lease: ManagedWorkerLease, id: string) {
  return JSON.stringify([lease.sessionId, lease.leaseId, id]);
}

function observedCall(event: ManagedEvent) {
  if (event.processed_at === null) {
    return null;
  }

  if (event.type === 'user.tool_confirmation' && event['result'] === 'allow') {
    const id = event['tool_use_id'];

    if (typeof id === 'string') {
      return { id, wasSeen: false, isAllowed: true };
    }
  }

  if (!workerToolEvents.has(event.type)) {
    return null;
  }

  if (event['evaluated_permission'] !== 'deny') {
    return { id: event.id, wasSeen: true, isAllowed: event['evaluated_permission'] !== 'ask' };
  }

  return null;
}

async function ensureOpen(transaction: Tx, lease: ManagedWorkerLease) {
  const state = await transaction.doc(Exposure, leaseKey(lease), null);

  if (state.isClosed) {
    failManagedRequest(HttpStatusCode.Forbidden, 'The worker lease has ended');
  }
}

async function pendingWorkerCalls(transaction: Tx, sessionId: string) {
  const ids = new Set<string>();
  const primary = await transaction.doc(Sessions, sessionId, null);

  if (primary.waiting !== null) {
    ids.add(primary.waiting);
  }

  for (const threadId of await liveThreadIds(sessionId).allInTransaction(transaction)) {
    if (threadId !== primary.threadId) {
      const id = await pendingChildCalls(sessionId).read(transaction, threadId);

      if (id !== undefined) {
        ids.add(id);
      }
    }
  }

  return ids;
}

export async function admitWorkerExposure(
  session: Pick<Session, 'commit'>,
  lease: ManagedWorkerLease,
  events: ReadonlyArray<ManagedEvent>,
) {
  await session.commit(async (transaction) => {
    await ensureOpen(transaction, lease);

    const observations = events.map(observedCall).filter((observation) => observation !== null);

    if (observations.length === 0) {
      return;
    }

    const pending = await pendingWorkerCalls(transaction, lease.sessionId);

    for (const { id, wasSeen, isAllowed } of observations) {
      if (pending.has(id)) {
        const use = await sessionEvents(lease.sessionId).describe(transaction, id);

        if (use !== undefined && workerToolEvents.has(use.event.type)) {
          const call = await transaction.doc(Calls, callKey(lease, id), null);
          call.wasSeen ||= wasSeen;
          call.isAllowed ||= isAllowed;
        }
      }
    }
  }, BACKGROUND_CONTEXT);
}

function workerResultId(event: ManagedWireObject): unknown {
  switch (event['type']) {
    case 'user.custom_tool_result':
      return event['custom_tool_use_id'];
    case 'user.tool_result':
      return event['tool_use_id'];
    default:
      return null;
  }
}

export async function assertWorkerResultExposure(
  transaction: Tx,
  lease: ManagedWorkerLease,
  events: ReadonlyArray<ManagedWireObject>,
): Promise<void> {
  await ensureOpen(transaction, lease);

  for (const event of events) {
    const id = workerResultId(event);

    if (typeof id !== 'string' || (await exposedWorkerCall(transaction, lease, id)) === null) {
      failManagedRequest(HttpStatusCode.Forbidden, 'This tool call was not exposed to the worker lease');
    }
  }
}

export async function closeWorkerExposure(transaction: Tx, lease: ManagedWorkerLease): Promise<void> {
  const exposure = await transaction.doc(Exposure, leaseKey(lease), null);
  exposure.isClosed = true;
}

export async function exposedWorkerCall(
  transaction: Tx,
  lease: ManagedWorkerLease,
  toolUseId: string | undefined | null,
): Promise<string | null> {
  if (toolUseId === undefined || toolUseId === null) {
    return null;
  }

  const call = await transaction.doc(Calls, callKey(lease, toolUseId), null);

  if (call.wasSeen && call.isAllowed) {
    return toolUseId;
  }

  return null;
}
