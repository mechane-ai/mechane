import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { failManagedRequest } from '../failure.ts';
import { Slot } from '../scheduler.ts';
import type { sessionState } from '../scheduler.ts';

type CoordinatorState = Awaited<ReturnType<typeof sessionState>>;

export async function requireCoordinatorTurn(transaction: Tx, state: CoordinatorState): Promise<void> {
  const slot = await transaction.doc(Slot);

  const ownsTurn = slot.owner === state.id && state.activeEvent !== null;
  const isPaused = state.waiting !== null || state.isBudgetReached;
  const isClosing = state.isArchived || state.mutationId !== null || state.interrupt !== null;

  if (!ownsTurn || isPaused || isClosing) {
    failManagedRequest(HttpStatusCode.Conflict, 'The coordinator turn has ended');
  }
}
