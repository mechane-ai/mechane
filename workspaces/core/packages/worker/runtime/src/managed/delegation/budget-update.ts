import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { liveThreadIds, requiredThread } from '../thread-records.ts';
import type { ManagedDelegationBudgetUpdate } from './protocol.ts';
import { ActiveChildren, Children } from './records.ts';
import type { Child } from './records.ts';

export async function hasProjectedBudgetPause(transaction: Tx, { origin }: Child) {
  const thread = await requiredThread(transaction, origin.sessionId, origin.threadId);

  return thread.status === 'idle' && thread.reason?.['type'] === 'budget_reached';
}

export async function queueChildBudgets(transaction: Tx, sessionId: string, revision: number) {
  for (const threadId of await liveThreadIds(sessionId).allInTransaction(transaction)) {
    const child = await Children.read(transaction, threadId);

    if (child?.retirement === 'live' && child.origin.sessionId === sessionId) {
      const isActive = (await ActiveChildren.read(transaction, threadId)) !== undefined;

      if (isActive || (await hasProjectedBudgetPause(transaction, child))) {
        await Children.put(transaction, threadId, {
          ...child,
          pendingBudgetRevision: revision,
          recoveryRevision: (child.recoveryRevision ?? 0) + 1,
        });
        await ActiveChildren.put(transaction, threadId, threadId);
      }
    }
  }
}

type BudgetDelivery = {
  readonly child: Child;
  readonly send: (update: ManagedDelegationBudgetUpdate) => Promise<null>;
};

export async function relayChildBudget(harness: Harness, { child, send }: BudgetDelivery) {
  const revision = child.pendingBudgetRevision;

  if (revision === undefined || revision === 0) {
    return;
  }

  await send({ origin: child.origin, revision });
  await harness.commit(async (transaction) => {
    const current = await Children.read(transaction, child.origin.threadId);

    if (current?.pendingBudgetRevision === revision) {
      await Children.put(transaction, child.origin.threadId, { ...current, pendingBudgetRevision: 0 });
    }
  }, BACKGROUND_CONTEXT);
}
