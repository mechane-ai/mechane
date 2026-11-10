import type { TaskContext } from '@mechane/harness-tools';
import type { MechTables } from '@mechane/mech-store';
import { InboxItemId, MechId } from '@mechane/records';
import type { ThreadId } from '@mechane/records';
import { Array, Option } from 'effect';

type ContextInput = {
  readonly store: MechTables;
  /** None reads the current input only when it has one unambiguous origin. */
  readonly threadId: Option.Option<ThreadId>;
};

/** Attribution comes from a work item's immutable origin, never the agent's supplied names or headers. */
export function readTaskContext({ store, threadId }: ContextInput): Option.Option<TaskContext> {
  const mech = store.mech();

  const originId = Option.match(threadId, {
    onNone: () => currentInboxOrigin({ store }),
    onSome: (id) => store.threadOrigin({ threadId: id }),
  });

  if (Option.isNone(mech) || Option.isNone(originId)) {
    return Option.none();
  }

  const workId: TaskContext['workId'] = Option.match(threadId, { onNone: () => originId.value, onSome: (id) => id });
  const task = { runtime: 'mechane' as const, instanceId: MechId.make(mech.value.id), workId };
  const origin = store.slackInboxOrigin({ inboxItemId: originId.value });

  if (Option.isNone(origin)) {
    const slack = Option.none();

    return Option.some({ ...task, slack });
  }

  const { destination, userId, messageTimestamp } = origin.value;
  const threadTs = Option.getOrElse(destination.threadTimestamp, () => messageTimestamp);

  const slack = Option.some({
    workspaceId: destination.teamId,
    userId,
    channelId: destination.channelId,
    threadTs,
    messageTs: messageTimestamp,
  });

  return Option.some({ ...task, slack });
}

type CurrentOriginInput = { readonly store: MechTables };

function currentInboxOrigin({ store }: CurrentOriginInput): Option.Option<InboxItemId> {
  const running = store.runningTurn();

  if (Option.isNone(running)) {
    return Option.none();
  }

  const items = store.turnInboxItemIds({ turnId: running.value });
  const only = Array.head(items);

  if (items.length !== 1 || Option.isNone(only)) {
    return Option.none();
  }

  const inboxItemId = InboxItemId.make(only.value);

  const origin = store.continuationOrigin({ inboxItemId });

  return Option.orElse(origin, () => Option.some(inboxItemId));
}
