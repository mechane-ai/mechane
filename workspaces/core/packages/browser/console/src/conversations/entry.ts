import { Chat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow/client';
import type { ConsoleData, ConversationHistory } from '@mechane/console-data';
import { HttpHeader, MechId, MediaType, TurnId } from '@mechane/records';
import type { ChatStatus, UIMessage } from 'ai';
import type { ResourceState } from '../resource.tsx';
import { chatTransport } from './transport.ts';

/** Native Chat owns the submitted-to-streaming lifecycle that disables a duplicate send. */
export const workingChatStatuses: ReadonlySet<ChatStatus> = new Set(['submitted', 'streaming']);

const RUN_ID_HEADER = 'x-mechane-run-id';
const WORKFLOW_ID_HEADER = 'x-workflow-run-id';

function workflowStreamUrl(endpoint: string, id: string): string {
  return `${endpoint}/${encodeURIComponent(id)}/stream`;
}

/** Acceptance identifies the durable run before its streamed reply finishes. */
export type MessageReceipt = { readonly id: string; readonly runId: string };
/** Retrying an uncertain send reuses this message identity. */
export type MessageSubmission = { readonly id: string; readonly text: string };

/** A retained native Chat and its server-authorized conversation identity. */
export type ConversationValue = {
  readonly chat: Chat<UIMessage>;
  readonly sessionId: string;
  readonly source: ConversationHistory['source'];
  readonly title: string;
  readonly consoleSessionId: string;
  /** Null when the source has no external conversation link. */
  readonly sourceUrl: string | null;
  /** Null when this conversation has no resumable workflow. */
  readonly activeWorkflowId: string | null;
  /** Null when this conversation has no admitted unfinished run. */
  readonly activeRunId: string | null;
  readonly hasMore: boolean;
  /** Null when no earlier history cursor is available. */
  readonly before: string | null;
  readonly isLoadingEarlier: boolean;
};

type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };

type CreateConversationEntry = {
  readonly data: ConsoleData;
  readonly mechId: string;
  /** Absent selects the server's most recent conversation. */
  readonly sessionId: string | undefined;
  readonly onResolved: (sessionId: string) => void;
};

function refreshMessages(
  history: ReadonlyArray<UIMessage>,
  current: ReadonlyArray<UIMessage>,
): Chat<UIMessage>['messages'] {
  const latest = new Map(history.map((message) => [message.id, message]));
  const firstOverlap = current.findIndex((message) => latest.has(message.id));

  if (firstOverlap === -1) {
    return [...current, ...history];
  }

  return [
    ...current.slice(0, firstOverlap),
    ...history,
    ...current.slice(firstOverlap).filter((message) => !latest.has(message.id)),
  ];
}

function prependMessages(
  history: ReadonlyArray<UIMessage>,
  current: ReadonlyArray<UIMessage>,
): Chat<UIMessage>['messages'] {
  const known = new Set(current.map((message) => message.id));

  return [...history.filter((message) => !known.has(message.id)), ...current];
}

/** Retains native streaming and acknowledgement state while the reader navigates between views. */
export function createConversationEntry({ data, mechId, sessionId, onResolved }: CreateConversationEntry) {
  const lifetime = new AbortController();
  const signal = AbortSignal.any([data.conversations.signal, lifetime.signal]);
  const listeners = new Set<() => void>();
  const admissions = new Map<string, ReturnType<typeof Promise.withResolvers<MessageReceipt>>>();
  const retainers = new Set<symbol>();

  const owner: Mutable<{
    readonly state: ResourceState<ConversationValue>;
    /** Absent until the first authorized history response. */
    readonly value: ConversationValue | undefined;
    /** Absent while no history read is in flight. */
    readonly loading: Promise<void> | undefined;
  }> = { state: { kind: 'pending' }, value: undefined, loading: undefined };

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

  function createChat(history: ConversationHistory): Chat<UIMessage> {
    const transport = new WorkflowChatTransport<UIMessage>({
      api: data.conversations.endpoint,
      fetch: data.conversations.fetch,
      prepareSendMessagesRequest: ({ messages }) => ({
        credentials: 'same-origin',
        headers: { [HttpHeader.ContentType]: MediaType.Json },
        body: { workspaceId: data.workspace.id, mechId, sessionId: history.sessionId, message: messages.at(-1) },
      }),
      prepareReconnectToStreamRequest: ({ api }) => {
        const workflowId = owner.value?.activeWorkflowId;
        const sessionStream = workflowStreamUrl(data.conversations.endpoint, history.sessionId);

        return {
          credentials: 'same-origin',
          api:
            api === sessionStream && workflowId !== null && workflowId !== undefined
              ? workflowStreamUrl(data.conversations.endpoint, workflowId)
              : api,
        };
      },
      onChatSendMessage: (response, options) => {
        const messageId = options.messages.at(-1)?.id;
        const runId = response.headers.get(RUN_ID_HEADER);
        const workflowId = response.headers.get(WORKFLOW_ID_HEADER);

        const hasRunIdentity = runId !== null && workflowId !== null;

        if (messageId === undefined || !hasRunIdentity || owner.value === undefined) {
          throw new Error('The server did not identify the accepted message.');
        }

        update({ ...owner.value, activeWorkflowId: workflowId, activeRunId: runId });
        admissions.get(messageId)?.resolve({ id: messageId, runId });
        admissions.delete(messageId);
      },
    });

    return new Chat<UIMessage>({
      id: history.sessionId,
      messages: history.messages,
      transport: chatTransport(transport),
      onFinish: ({ isDisconnect }) => {
        if (!isDisconnect) {
          void Promise.allSettled([data.refreshActivity(mechId), refreshAfterCurrent()]);
        }
      },
    });
  }

  async function load(): Promise<void> {
    const previous = owner.value;

    if (previous !== undefined) {
      publish({ kind: 'ready', value: previous, refresh: { kind: 'pending' } });
    } else if (owner.state.kind === 'failed') {
      publish({ ...owner.state, isRetrying: true });
    }

    try {
      const selectedSession = previous?.sessionId ?? sessionId;

      const history = await data.conversations.history(
        { mechId, ...(selectedSession === undefined ? {} : { sessionId: selectedSession }) },
        signal,
      );

      signal.throwIfAborted();

      const chat = previous?.chat ?? createChat(history);

      if (previous !== undefined && !workingChatStatuses.has(chat.status)) {
        chat.messages = refreshMessages(history.messages, chat.messages);
      }

      const current = owner.value;
      const isStreaming = workingChatStatuses.has(chat.status);
      const hasWorkflowChanged = current !== undefined && current.activeWorkflowId !== previous?.activeWorkflowId;
      const activeRunId = hasWorkflowChanged ? current.activeRunId : history.activeRunId;
      const activeWorkflowId = hasWorkflowChanged ? current.activeWorkflowId : history.activeWorkflowId;

      const hasUnattachedWorkflow = current === undefined || current.activeWorkflowId !== activeWorkflowId;
      const shouldResume = activeWorkflowId !== null && !isStreaming && hasUnattachedWorkflow;

      update({
        chat,
        sessionId: history.sessionId,
        source: history.source,
        title: history.title,
        consoleSessionId: history.consoleSessionId,
        sourceUrl: history.sourceUrl,
        activeWorkflowId,
        activeRunId,
        hasMore: current?.hasMore ?? history.hasMore,
        before: current === undefined ? history.before : current.before,
        isLoadingEarlier: current?.isLoadingEarlier ?? false,
      });
      onResolved(history.sessionId);

      if (shouldResume) {
        void chat.resumeStream();
      }
    } catch (problem) {
      if (signal.aborted) {
        return;
      }

      if (previous === undefined) {
        publish({ kind: 'failed', problem, retry: retryRefresh, isRetrying: false });
      } else {
        publish({
          kind: 'ready',
          value: previous,
          refresh: { kind: 'failed', problem, retry: retryRefresh, isRetrying: false },
        });
      }
    }
  }

  async function refresh(): Promise<void> {
    if (owner.loading !== undefined) {
      return await owner.loading;
    }

    owner.loading = load();

    try {
      await owner.loading;
    } finally {
      owner.loading = undefined;
    }
  }

  async function refreshAfterCurrent(): Promise<void> {
    await owner.loading;
    await refresh();
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

    if (!value.hasMore || value.before === null) {
      return;
    }

    update({ ...value, isLoadingEarlier: true });

    try {
      const history = await data.conversations.history(
        { mechId, sessionId: value.sessionId, before: value.before },
        signal,
      );

      signal.throwIfAborted();

      value.chat.messages = prependMessages(history.messages, value.chat.messages);

      update({ ...(owner.value ?? value), hasMore: history.hasMore, before: history.before, isLoadingEarlier: false });
    } catch (problem) {
      const restored = { ...(owner.value ?? value), isLoadingEarlier: false };

      owner.value = restored;

      publish({
        kind: 'ready',
        value: restored,
        refresh: { kind: 'failed', problem, retry: retryEarlier, isRetrying: false },
      });
    }
  }

  async function send(submission: MessageSubmission): Promise<MessageReceipt> {
    const value = owner.value;

    if (value?.source !== 'console') {
      throw new Error('Open the console conversation to send a message here.');
    }

    if (workingChatStatuses.has(value.chat.status)) {
      throw new Error('Wait for this reply before sending another message.');
    }

    const admitted = Promise.withResolvers<MessageReceipt>();

    admissions.set(submission.id, admitted);

    const existing = value.chat.messages.some((message) => message.id === submission.id);

    void value.chat
      .sendMessage({
        id: submission.id,
        role: 'user',
        parts: [{ type: 'text', text: submission.text }],
        ...(existing ? { messageId: submission.id } : {}),
      })
      .then(
        () => {
          admissions.get(submission.id)?.reject(value.chat.error ?? new Error('The message was not acknowledged.'));
          admissions.delete(submission.id);
        },
        (problem: unknown) => {
          admissions.get(submission.id)?.reject(problem);
          admissions.delete(submission.id);
        },
      );

    return await admitted.promise;
  }

  async function cancel(): Promise<void> {
    const value = owner.value;

    if (value?.activeRunId === null || value?.activeRunId === undefined) {
      return;
    }

    await data.commands.cancelTurn({ mechId: MechId.make(mechId), turnId: TurnId.make(value.activeRunId) });
    await value.chat.stop();
    await refresh();
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

      function onVisible(): void {
        if (document.visibilityState === 'visible') {
          void refresh();
        }
      }

      void refresh();
      window.addEventListener('focus', onVisible);
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        retainers.delete(retainer);
        window.removeEventListener('focus', onVisible);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
    isRetained: () => retainers.size > 0,
    refresh,
    async resume() {
      await owner.value?.chat.resumeStream();
    },
    earlier,
    send,
    cancel,
    async dispose() {
      lifetime.abort();

      for (const admission of admissions.values()) {
        admission.reject(new Error('The conversation was closed before acknowledgement.'));
      }

      admissions.clear();
      listeners.clear();
      await owner.value?.chat.dispose();
    },
  };
}

/** The workspace owns disposal; views retain and release readers without closing the native Chat. */
export type ConversationEntry = ReturnType<typeof createConversationEntry>;
