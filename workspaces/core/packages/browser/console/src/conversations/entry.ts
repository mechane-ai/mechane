import { canRetainResult } from '@mechane/console-data';
import type { ConsoleData, ConversationHistory } from '@mechane/console-data';
import { NotificationId } from '@mechane/protocol';
import type { ConsoleMessage, NotificationReceipt } from '@mechane/protocol';
import { MechId, Sequence } from '@mechane/records';
import { Option } from 'effect';
import type { ResourceState } from '../resource.tsx';

export type MessageReceipt = NotificationReceipt;
export type MessageSubmission = { readonly id: string; readonly text: string };

export type ConversationValue = {
  readonly messages: ReadonlyArray<ConsoleMessage>;
  readonly hasMore: boolean;
  readonly beforeSequence: Option.Option<Sequence>;
  readonly isLoadingEarlier: boolean;
};

type CreateConversationEntry = {
  readonly getData: () => ConsoleData;
  readonly conversations: ConsoleData['conversations'];
  readonly mechId: string;
};

function mergeMessages(
  previous: ReadonlyArray<ConsoleMessage>,
  incoming: ReadonlyArray<ConsoleMessage>,
): ReadonlyArray<ConsoleMessage> {
  const messages = new Map([...previous, ...incoming].map((message) => [message.id, message]));

  return [...messages.values()].toSorted((left, right) => left.sequence - right.sequence);
}

/** Navigation retains public messages and accepted sends without subscribing to private model output. */
export function createConversationEntry({ getData, conversations, mechId }: CreateConversationEntry) {
  const lifetime = new AbortController();
  const signal = AbortSignal.any([conversations.signal, lifetime.signal]);
  const listeners = new Set<() => void>();
  const retainers = new Set<symbol>();
  const submissions = new Map<string, Promise<MessageReceipt>>();

  const owner: {
    state: ResourceState<ConversationValue>;
    value: ConversationValue | undefined;
    observation: ReturnType<ConsoleData['conversations']['observe']> | undefined;
  } = { state: { kind: 'pending' }, value: undefined, observation: undefined };

  function publish(next: ResourceState<ConversationValue>): void {
    if (signal.aborted) {
      return;
    }

    owner.state = next;

    for (const listener of listeners) {
      listener();
    }
  }

  function update(value: ConversationValue): void {
    owner.value = value;

    publish({ kind: 'ready', value, refresh: { kind: 'idle' } });
  }

  function pending(): void {
    if (owner.value !== undefined) {
      publish({ kind: 'ready', value: owner.value, refresh: { kind: 'pending' } });
    } else if (owner.state.kind === 'failed') {
      publish({ ...owner.state, isRetrying: true });
    }
  }

  function receive(history: ConversationHistory): void {
    const previous = owner.value;

    update({
      messages: mergeMessages(previous?.messages ?? [], history.messages),
      hasMore: previous?.hasMore ?? history.hasMore,
      beforeSequence: previous?.beforeSequence ?? history.beforeSequence,
      isLoadingEarlier: previous?.isLoadingEarlier ?? false,
    });
  }

  function failed(problem: unknown, retry = retryRefresh): void {
    if (!canRetainResult(problem)) {
      owner.value = undefined;
    }

    if (owner.value === undefined) {
      publish({ kind: 'failed', problem, retry, isRetrying: false });
    } else {
      publish({ kind: 'ready', value: owner.value, refresh: { kind: 'failed', problem, retry, isRetrying: false } });
    }
  }

  function latestSequence(): Sequence | undefined {
    if (owner.value === undefined) {
      return undefined;
    }

    return owner.value.messages.at(-1)?.sequence ?? Sequence.make(0);
  }

  async function refresh(): Promise<void> {
    if (owner.observation !== undefined) {
      await owner.observation.refresh();

      return;
    }

    pending();

    try {
      const afterSequence = latestSequence();
      const target = afterSequence === undefined ? { mechId } : { mechId, afterSequence };
      const history = await conversations.history(target, signal);

      signal.throwIfAborted();
      receive(history);
    } catch (problem) {
      if (!signal.aborted) {
        failed(problem);
      }
    }
  }

  function retryRefresh(): void {
    void refresh();
  }

  function retryEarlier(): void {
    void earlier();
  }

  async function earlier(): Promise<void> {
    const value = owner.value;

    if (value === undefined || value.isLoadingEarlier) {
      return;
    }

    if (!value.hasMore || Option.isNone(value.beforeSequence)) {
      return;
    }

    update({ ...value, isLoadingEarlier: true });

    try {
      const history = await conversations.history({ mechId, beforeSequence: value.beforeSequence.value }, signal);

      signal.throwIfAborted();

      update({
        messages: mergeMessages(owner.value?.messages ?? value.messages, history.messages),
        hasMore: history.hasMore,
        beforeSequence: history.beforeSequence,
        isLoadingEarlier: false,
      });
    } catch (problem) {
      if (!signal.aborted) {
        owner.value = { ...(owner.value ?? value), isLoadingEarlier: false };

        failed(problem, retryEarlier);
      }
    }
  }

  async function send(submission: MessageSubmission): Promise<MessageReceipt> {
    const pendingSubmission = submissions.get(submission.id);

    if (pendingSubmission !== undefined) {
      return await pendingSubmission;
    }

    signal.throwIfAborted();

    const admission = getData().commands.sendNotification({
      mechId: MechId.make(mechId),
      notificationId: NotificationId.make(submission.id),
      text: submission.text,
      source: { name: 'console', eventId: submission.id },
    });

    submissions.set(submission.id, admission);

    try {
      const receipt = await admission;

      void refresh();

      return receipt;
    } finally {
      submissions.delete(submission.id);
    }
  }

  return {
    read: () => owner.state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    retain() {
      const retainer = Symbol('conversation reader');

      retainers.add(retainer);

      owner.observation ??= conversations.observe(
        mechId,
        { afterSequence: latestSequence, onPending: pending, onHistory: receive, onFailure: failed },
        signal,
      );

      return () => {
        retainers.delete(retainer);

        if (retainers.size === 0) {
          owner.observation?.dispose();

          owner.observation = undefined;
        }
      };
    },
    isRetained: () => retainers.size > 0,
    refresh,
    earlier,
    send,
    dispose() {
      lifetime.abort();
      owner.observation?.dispose();

      owner.observation = undefined;

      listeners.clear();
    },
  };
}

export type ConversationEntry = ReturnType<typeof createConversationEntry>;
