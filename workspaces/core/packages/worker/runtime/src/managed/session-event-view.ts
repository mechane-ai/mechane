import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Session } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import type { WithControl } from '../actor/types.ts';
import { listManagedEvents, managedEventTail, readManagedEventTail } from './event-log/read.ts';
import { failManagedRequest } from './failure.ts';
import type { ManagedEvent, ManagedEventPageInput, ManagedEventScope } from './protocol.ts';
import { sessionState } from './scheduler.ts';
import { readManagedThread } from './thread-records.ts';
import { readPublishedUsagePage } from './usage-projection.ts';
import { admitWorkerExposure } from './worker-exposure.ts';

type ReaderOwner = { readonly workspaceId: string; readonly withControl: WithControl };

type EventView = ReaderOwner & {
  readonly session: Session;
  readonly flushUsage: (sessionId?: string) => Promise<void>;
};

type ChangesInput = ManagedEventScope & Pick<ManagedEventPageInput, 'limit'> & { readonly offset: number };

export function createManagedEventView({ session, workspaceId, withControl, flushUsage }: EventView) {
  async function eventScope<T extends ManagedEventScope>(input: T) {
    const { threadId, ...scope } = input;

    return await session.commit(async (transaction) => {
      const state = await sessionState(transaction, input.sessionId);

      if (threadId === undefined || threadId === state.threadId) {
        return scope;
      }

      await readManagedThread(transaction, input.sessionId, threadId);

      return { ...scope, threadId };
    }, BACKGROUND_CONTEXT);
  }

  async function deliverWorkerPage(scope: ManagedEventScope, rows: ReadonlyArray<ManagedEvent>) {
    if (scope.workerLeaseId === undefined) {
      return false;
    }

    const lease = { sessionId: scope.sessionId, leaseId: scope.workerLeaseId };

    const isActive = await withControl(
      async (store) => await store.managed.worker.isLeaseActive({ workspaceId, ...lease }),
    );

    if (!isActive) {
      failManagedRequest(HttpStatusCode.Forbidden, 'The worker lease has ended');
    }

    await admitWorkerExposure(session, lease, rows);

    return true;
  }

  async function events(input: ManagedEventPageInput) {
    const scope = await eventScope(input);
    const page = await listManagedEvents(session, scope);

    if (await deliverWorkerPage(input, page.data)) {
      return page;
    }

    return await readPublishedUsagePage({ harness: session, localId: input.sessionId, flush: flushUsage }, page);
  }

  async function tail(input: ManagedEventScope & { readonly lastEventId?: string | undefined }) {
    const scope = await eventScope(input);

    return await managedEventTail(session, scope);
  }

  async function changes(input: ChangesInput, alreadyMirrored?: (id: string) => Promise<boolean>) {
    const scope = await eventScope(input);
    const page = await readManagedEventTail(session, scope, alreadyMirrored);

    if (await deliverWorkerPage(input, page.data)) {
      return page;
    }

    await flushUsage(input.sessionId);

    return await readPublishedUsagePage({ harness: session, localId: input.sessionId, flush: flushUsage }, page);
  }

  return { changes, events, tail };
}
