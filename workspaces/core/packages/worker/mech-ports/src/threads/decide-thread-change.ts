import { ThreadChangeOutcome } from '@mechane/harness-tools';
import type { ThreadChange } from '@mechane/harness-tools';
import { ThreadState } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import { DateTime, Option } from 'effect';
import type { PortDecisionInput } from './types.ts';

/** An update_thread call, decided in one transaction at the time of the call. */
type ThreadChangeDecision = ThreadChange & PortDecisionInput;

/**
 * Decides an update_thread call in one transaction. A resolved thread is final, so only a change it already holds is
 * made, which answers pi's rerun of the call that resolved it.
 */
export function decideThreadChange({
  store,
  taskId,
  threadId,
  state,
  note,
  resumeAfter,
  now,
}: ThreadChangeDecision): ThreadChangeOutcome {
  if (store.hasThreadUpdate({ taskId })) {
    return ThreadChangeOutcome.cases.Updated.make({});
  }

  const thread = store.thread({ threadId });

  if (Option.isNone(thread)) {
    return ThreadChangeOutcome.cases.ThreadMissing.make({});
  }

  const isNoteHeld = Option.match(note, {
    onNone: () => true,
    onSome: (given) => Option.contains(thread.value.note, given),
  });

  const isHeld = state === thread.value.state && isNoteHeld;

  if (thread.value.state === ThreadState.Resolved && !isHeld) {
    return ThreadChangeOutcome.cases.ThreadResolved.make({});
  }

  store.updateThread({ threadId, state, note, now });
  store.cancelThreadRequestWait({ threadId });

  const delay = Option.filter(resumeAfter, () => state === ThreadState.Waiting);
  const resumeAt = Option.map(delay, (duration) => DateTime.addDuration(now, duration));
  const inboxItemId = InboxItemId.make(crypto.randomUUID());

  store.recordThreadUpdate({ taskId, threadId, resumeAt, inboxItemId });

  return ThreadChangeOutcome.cases.Updated.make({});
}
