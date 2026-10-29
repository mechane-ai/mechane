import { ThreadOpeningOutcome } from '@mechane/harness-tools';
import type { ThreadOpening } from '@mechane/harness-tools';
import { OPEN_THREADS_PER_MECH } from '@mechane/protocol';
import { ThreadId } from '@mechane/records';
import { Option } from 'effect';
import type { PortDecisionInput } from './types.ts';

/** An open_thread call, decided in one transaction at the time of the call. */
type ThreadOpeningDecision = ThreadOpening & PortDecisionInput;

/**
 * Decides an open_thread call in one transaction: a task that opened its thread answers with it, so pi's rerun after a
 * restart answers the same. Otherwise a thread opens, working, while the mech keeps fewer open than its limit.
 */
export function decideThreadOpening({ store, taskId, title, now }: ThreadOpeningDecision): ThreadOpeningOutcome {
  const opened = store.openedThread({ taskId });

  if (Option.isSome(opened)) {
    return ThreadOpeningOutcome.cases.Opened.make({ threadId: opened.value.id });
  }

  if (store.openThreadCount() >= OPEN_THREADS_PER_MECH) {
    return ThreadOpeningOutcome.cases.ThreadsFull.make({});
  }

  const threadId = ThreadId.make(crypto.randomUUID());

  store.openThread({ threadId, taskId, title, now });

  return ThreadOpeningOutcome.cases.Opened.make({ threadId });
}
