import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Session, Tx } from '@earendil-works/pi-durable';
import type { WithControl } from '../actor/types.ts';
import { managedEventSequence } from './event-log/write.ts';
import { outcomeRecords } from './outcomes.ts';
import type {
  ManagedSessionReference,
  ManagedSessionState,
  ManagedSessionThreadReference,
  ManagedThreadPageInput,
} from './protocol.ts';
import { DirtySessions, sessionState } from './scheduler.ts';
import { createManagedEventView } from './session-event-view.ts';
import { readManagedSessionState } from './thread-state.ts';
import { managedThread, managedThreads } from './threads.ts';

type Options = {
  readonly harness: Session;
  readonly workspaceId: string;
  readonly withControl: WithControl;
  readonly flushUsage: (sessionId?: string) => Promise<void>;
};

async function sessionSnapshot(transaction: Tx, sessionId: string) {
  const state = await readManagedSessionState(transaction, sessionId);
  const outcomes = await outcomeRecords(sessionId).allInTransaction(transaction);

  return { ...state, outcome_evaluations: outcomes };
}

export function createManagedSessionView({ harness, workspaceId, withControl, flushUsage }: Options) {
  async function read({ sessionId }: ManagedSessionReference): Promise<ManagedSessionState> {
    const state = await harness.commit(
      async (transaction) => await sessionSnapshot(transaction, sessionId),
      BACKGROUND_CONTEXT,
    );

    await flushUsage(sessionId);

    return state;
  }

  async function thread(input: ManagedSessionThreadReference) {
    await flushUsage(input.sessionId);

    return await managedThread(harness, input);
  }

  async function threads(input: ManagedThreadPageInput) {
    await flushUsage(input.sessionId);
    await harness.commit(async (transaction) => {
      await sessionState(transaction, input.sessionId);
    }, BACKGROUND_CONTEXT);

    return await managedThreads(harness, input);
  }

  async function publishSnapshot(id: string) {
    const snapshot = await harness.commit(async (transaction) => {
      const state = await sessionState(transaction, id);

      if (state.publicSessionId !== id) {
        await DirtySessions.remove(transaction, id);

        return null;
      }

      const { status, outcome_evaluations: outcomeEvaluations } = await sessionSnapshot(transaction, id);
      const sequence = await managedEventSequence(transaction, id);

      return { workspaceId, id, sequence, status, updatedAt: new Date().toISOString(), outcomeEvaluations };
    }, BACKGROUND_CONTEXT);

    if (snapshot === null) {
      return;
    }

    await withControl(async (store) => await store.managed.sessions.project(snapshot));
    await harness.commit(async (transaction) => {
      if ((await managedEventSequence(transaction, id)) === snapshot.sequence) {
        await DirtySessions.remove(transaction, id);
      }
    }, BACKGROUND_CONTEXT);
  }

  async function project() {
    await flushUsage();

    const pending = await DirtySessions.page(harness, { maxRows: 16 }, BACKGROUND_CONTEXT);

    for (const id of pending.items) {
      await publishSnapshot(id);
    }
  }

  const journal = createManagedEventView({ session: harness, workspaceId, withControl, flushUsage });

  return { read, thread, threads, ...journal, project };
}
