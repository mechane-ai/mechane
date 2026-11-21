import { managedSessionName } from '@mechane/agent-slot';
import type { SlotNamespace } from '@mechane/agent-slot';
import { ManagedRuntimeError, ManagedRuntimeFailureWire } from '@mechane/model-gateway';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import type {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationLeaseLoss,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationRead,
  ManagedDelegationSend,
} from './delegation/protocol.ts';
import { ManagedDelegationPage } from './delegation/protocol.ts';
import { managedActorUrl } from './identity.ts';
import type { ManagedDelegationPreview } from './preview-coordinates.ts';
import {
  ManagedAgentScope,
  ManagedEvent,
  ManagedEventPage,
  ManagedSessionState,
  ManagedSessionThread,
  ManagedThreadPage,
  ManagedWireObject,
} from './protocol.ts';
import type {
  ManagedEventPageInput,
  ManagedSessionMutation,
  ManagedSessionOpen,
  ManagedSessionReference,
  ManagedSessionSend,
  ManagedSessionThreadReference,
  ManagedStreamInput,
  ManagedThreadPageInput,
  ManagedWorkerLease,
} from './protocol.ts';

type DelegationStreamInput = ManagedDelegationPreview & { readonly signal?: AbortSignal | undefined };

type FetchMethodInput = {
  readonly targetId: string;
  readonly method: string;
  readonly input: unknown;
  readonly signal?: AbortSignal | undefined;
};

type CallMethodInput<T> = {
  readonly targetId: string;
  readonly method: string;
  readonly input: unknown;
  readonly output: Schema.Codec<T, unknown>;
};

const Acknowledged = Schema.Boolean;

export function createManagedAgentRuntime(sessions: Pick<SlotNamespace, 'getByName'>, scope: ManagedAgentScope) {
  const validated = Schema.decodeUnknownSync(ManagedAgentScope)(scope);

  async function fetchMethod({ targetId, method, input, signal }: FetchMethodInput): Promise<Response> {
    const stub = sessions.getByName(managedSessionName({ workspaceId: validated.workspaceId, id: targetId }));

    const request = new Request(managedActorUrl, {
      method: HttpMethod.Post,
      headers: { [HttpHeader.ContentType]: MediaType.Json },
      body: JSON.stringify({ scope: validated, method, input }),
      signal: signal ?? new AbortController().signal,
    });

    const response = await stub.fetch(request);

    if (!response.ok) {
      const result = Schema.decodeUnknownResult(ManagedRuntimeFailureWire)(await response.json());

      if (result._tag === 'Success') {
        throw new ManagedRuntimeError(result.success);
      }

      throw new Error('The managed agent returned an invalid failure');
    }

    return response;
  }

  async function call<T>({ targetId, method, input, output }: CallMethodInput<T>): Promise<T> {
    const response = await fetchMethod({ targetId, method, input });

    return Schema.decodeUnknownSync(output)(await response.json());
  }

  return {
    loseWorkerLease: async (input: ManagedWorkerLease): Promise<void> => {
      await call({ targetId: input.sessionId, method: 'loseWorkerLease', input, output: Schema.Null });
    },
    delegateDelete: (input: ManagedDelegationOrigin) =>
      call({ targetId: input.threadId, method: 'delegateDelete', input, output: Acknowledged }),
    delegateStop: (input: ManagedDelegationOrigin) =>
      call({ targetId: input.threadId, method: 'delegateStop', input, output: Acknowledged }),
    delegateLoseWorkerLease: (input: ManagedDelegationLeaseLoss) =>
      call({
        targetId: input.origin.threadId,
        method: 'delegateLoseWorkerLease',
        input,
        output: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      }),
    delegatePreviews: ({ signal, ...input }: DelegationStreamInput) =>
      fetchMethod({ targetId: input.origin.threadId, method: 'delegatePreviews', input, signal }),
    delegateOpen: (input: ManagedDelegationOpen) =>
      call({ targetId: input.origin.threadId, method: 'delegateOpen', input, output: ManagedSessionState }),
    delegateUpdateBudget: (input: ManagedDelegationBudgetUpdate) =>
      call({ targetId: input.origin.threadId, method: 'delegateUpdateBudget', input, output: Schema.Null }),
    delegateRead: (input: ManagedDelegationRead) =>
      call({ targetId: input.origin.threadId, method: 'delegateRead', input, output: ManagedDelegationPage }),
    delegateSend: (input: ManagedDelegationSend) =>
      call({ targetId: input.origin.threadId, method: 'delegateSend', input, output: Schema.Array(ManagedEvent) }),
    open: (input: ManagedSessionOpen) =>
      call({ targetId: input.sessionId, method: 'open', input, output: ManagedSessionState }),
    send: (input: ManagedSessionSend) =>
      call({ targetId: input.sessionId, method: 'send', input, output: Schema.Array(ManagedEvent) }),
    read: (input: ManagedSessionReference) =>
      call({ targetId: input.sessionId, method: 'read', input, output: ManagedSessionState }),
    events: (input: ManagedEventPageInput) =>
      call({ targetId: input.sessionId, method: 'events', input, output: ManagedEventPage }),
    threads: (input: ManagedThreadPageInput) =>
      call({ targetId: input.sessionId, method: 'threads', input, output: ManagedThreadPage }),
    thread: (input: ManagedSessionThreadReference) =>
      call({ targetId: input.sessionId, method: 'thread', input, output: ManagedSessionThread }),
    archiveThread: (input: ManagedSessionThreadReference) =>
      call({ targetId: input.sessionId, method: 'archiveThread', input, output: ManagedSessionThread }),
    mutateSession: (input: ManagedSessionMutation) =>
      call({ targetId: input.sessionId, method: 'mutateSession', input, output: Schema.NullOr(ManagedWireObject) }),
    stream: ({ signal, ...input }: ManagedStreamInput) =>
      fetchMethod({ targetId: input.sessionId, method: 'stream', input, signal }),
  };
}

export type ManagedAgentRuntime = ReturnType<typeof createManagedAgentRuntime>;
