import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import type { ActorNamespace } from '../actor/client.ts';
import type {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationLeaseLoss,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationRead,
  ManagedDelegationSend,
} from './delegation/protocol.ts';
import { ManagedDelegationPage } from './delegation/protocol.ts';
import { ManagedRuntimeError, ManagedRuntimeFailureWire } from './failure.ts';
import { managedActorName, managedActorUrl } from './identity.ts';
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

const ManagedAttention = Schema.Struct({
  sessionId: Schema.NullOr(Schema.String),
  queuedSessionIds: Schema.Array(Schema.String),
});

export function createManagedAgentRuntime(namespace: ActorNamespace, scope: ManagedAgentScope) {
  const validated = Schema.decodeUnknownSync(ManagedAgentScope)(scope);
  const stub = namespace.getByName(managedActorName(validated));

  async function fetchMethod(method: string, input: unknown, signal?: AbortSignal): Promise<Response> {
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

  async function call<T>(method: string, input: unknown, output: Schema.Codec<T, unknown>): Promise<T> {
    const response = await fetchMethod(method, input);

    return Schema.decodeUnknownSync(output)(await response.json());
  }

  return {
    attention: () => call('attention', {}, ManagedAttention),
    loseWorkerLease: async (input: ManagedWorkerLease): Promise<void> => {
      await call('loseWorkerLease', input, Schema.Null);
    },
    delegateDelete: (input: ManagedDelegationOrigin) => call('delegateDelete', input, Schema.Boolean),
    delegateStop: (input: ManagedDelegationOrigin) => call('delegateStop', input, Schema.Boolean),
    delegateLoseWorkerLease: (input: ManagedDelegationLeaseLoss) =>
      call('delegateLoseWorkerLease', input, Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
    delegatePreviews: ({ signal, ...input }: DelegationStreamInput) => fetchMethod('delegatePreviews', input, signal),
    delegateOpen: (input: ManagedDelegationOpen) => call('delegateOpen', input, ManagedSessionState),
    delegateUpdateBudget: (input: ManagedDelegationBudgetUpdate) => call('delegateUpdateBudget', input, Schema.Null),
    delegateRead: (input: ManagedDelegationRead) => call('delegateRead', input, ManagedDelegationPage),
    delegateSend: (input: ManagedDelegationSend) => call('delegateSend', input, Schema.Array(ManagedEvent)),
    open: (input: ManagedSessionOpen) => call('open', input, ManagedSessionState),
    send: (input: ManagedSessionSend) => call('send', input, Schema.Array(ManagedEvent)),
    read: (input: ManagedSessionReference) => call('read', input, ManagedSessionState),
    events: (input: ManagedEventPageInput) => call('events', input, ManagedEventPage),
    threads: (input: ManagedThreadPageInput) => call('threads', input, ManagedThreadPage),
    thread: (input: ManagedSessionThreadReference) => call('thread', input, ManagedSessionThread),
    archiveThread: (input: ManagedSessionThreadReference) => call('archiveThread', input, ManagedSessionThread),
    mutateSession: (input: ManagedSessionMutation) => call('mutateSession', input, Schema.NullOr(ManagedWireObject)),
    stream: ({ signal, ...input }: ManagedStreamInput) => fetchMethod('stream', input, signal),
  };
}

export type ManagedAgentRuntime = ReturnType<typeof createManagedAgentRuntime>;
