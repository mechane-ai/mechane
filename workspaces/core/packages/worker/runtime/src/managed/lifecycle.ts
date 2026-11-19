import type { Tx } from '@earendil-works/pi-durable';
import type { ManagedWireObject } from './protocol.ts';
import { Sessions } from './scheduler.ts';
import { transitionManagedThread } from './thread-state.ts';

type Transition = {
  readonly sessionId: string;
  readonly status: 'running' | 'idle' | 'terminated';
  readonly reason?: ManagedWireObject;
  readonly isForced?: boolean;
};

export async function transition(transaction: Tx, change: Transition) {
  const state = await transaction.doc(Sessions, change.sessionId, null);

  if (state.status === 'terminated' && change.status !== 'terminated') {
    return;
  }

  if (state.status === 'idle' && change.status === 'running') {
    state.mcpCatalogKey = '';
  }

  state.status = change.status;
  state.stopReason = null;

  if (change.reason !== undefined) {
    state.stopReason = JSON.stringify(change.reason);
  }

  await transitionManagedThread(transaction, {
    sessionId: change.sessionId,
    threadId: state.threadId,
    status: change.status,
    stopReason: change.reason ?? null,
    isForced: change.isForced === true,
  });
}
