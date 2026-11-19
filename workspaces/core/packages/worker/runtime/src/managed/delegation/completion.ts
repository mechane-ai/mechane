import type { Tx } from '@earendil-works/pi-durable';
import { appendManagedEvent } from '../event-log/write.ts';
import { transition } from '../lifecycle.ts';
import { queueInput, sessionState } from '../scheduler.ts';
import { transitionManagedThread } from '../thread-state.ts';
import { ActiveChildren, Children } from './records.ts';
import type { Child } from './records.ts';

export async function notifyCoordinator(transaction: Tx, sessionId: string, eventId: string): Promise<void> {
  const parent = await sessionState(transaction, sessionId);

  if (parent.isArchived || parent.status === 'terminated') {
    return;
  }

  await queueInput(transaction, sessionId, eventId);

  if (parent.waiting === null && !parent.isBudgetReached) {
    await transition(transaction, { sessionId, status: 'running' });
  }
}

export async function rejectDelegationOpen(transaction: Tx, previous: Child, status: number): Promise<void> {
  const { sessionId, threadId } = previous.origin;
  const child = await Children.read(transaction, threadId);

  if (child === undefined || child.isOpened || child.retirement !== 'live') {
    return;
  }

  await appendManagedEvent(
    transaction,
    { sessionId, threadId },
    {
      type: 'session.error',
      error: {
        type: 'unknown_error',
        message: `The delegated execution owner rejected its pinned configuration (HTTP ${status}).`,
        retry_status: { type: 'exhausted' },
      },
    },
  );

  const notices = new Set<string>();

  await transitionManagedThread(transaction, {
    sessionId,
    threadId,
    status: 'terminated',
    onEvent(event) {
      notices.add(event.id);
    },
  });

  for (const notice of notices) {
    await notifyCoordinator(transaction, sessionId, notice);
  }

  await Children.put(transaction, threadId, { ...child, retirement: 'stopped' });
  await ActiveChildren.remove(transaction, threadId);
}
