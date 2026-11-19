import type { SubmissionId, Tx } from '@earendil-works/pi-durable';
import { queueChildBudgets } from './delegation/budget-update.ts';
import { transition } from './lifecycle.ts';
import { enqueue, release, sessionState } from './scheduler.ts';
import { reconcileManagedSessionStatus } from './thread-state.ts';

export async function pauseManagedBudget(transaction: Tx, id: string): Promise<void> {
  const state = await sessionState(transaction, id);
  state.isBudgetReached = true;

  await release(transaction, id);
  await transition(transaction, { sessionId: id, status: 'idle', reason: { type: 'budget_reached' } });
}

export async function resumeManagedBudget(transaction: Tx, id: string): Promise<void> {
  const state = await sessionState(transaction, id);

  await applyManagedBudgetRevision(transaction, {
    sessionId: id,
    revision: state.budgetRevision + 1,
    isReached: false,
  });
}

type BudgetRevision = { readonly sessionId: string; readonly revision: number; readonly isReached: boolean };

export async function applyManagedBudgetRevision(transaction: Tx, { sessionId, revision, isReached }: BudgetRevision) {
  const state = await sessionState(transaction, sessionId);

  if (state.budgetRevision >= revision) {
    return;
  }

  state.budgetRevision = revision;

  await queueChildBudgets(transaction, sessionId, revision);

  if (isReached || !state.isBudgetReached) {
    return;
  }

  state.isBudgetReached = false;

  if (state.activeEvent !== null || state.pendingHead < state.pendingTail) {
    await transition(transaction, { sessionId, status: 'running' });
    await enqueue(transaction, sessionId);
  } else {
    await reconcileManagedSessionStatus(transaction, sessionId);
  }
}

export async function settledBudgetSubmission(transaction: Tx, id: SubmissionId | null): Promise<SubmissionId | null> {
  if (id === null) {
    return null;
  }

  const receipt = await transaction.submission(id);

  switch (receipt?.status) {
    case 'done':
    case 'unanswered':
      return receipt.id;
    case 'placed':
    case 'queued':
    case undefined:
      return null;
  }
}
