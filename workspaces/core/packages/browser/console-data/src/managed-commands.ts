import { HttpStatusCode } from '@mechane/records';
import { Duration } from 'effect';
import { canRetainResult } from './api.ts';
import { managedStatus } from './managed-errors.ts';
import { admitSession } from './managed-reads.ts';
import type { ManagedAttention, ManagedClient, ManagedHistoryPage } from './managed-reads.ts';
import type { ManagedId } from './managed-records.ts';
import { projectAgent, projectSession } from './managed-records.ts';
import { waitForRetry } from './read-recovery.ts';
import { readRequests } from './requests.ts';
import type { ReadKind, ReadRequest } from './requests.ts';

const STREAM_RECONNECT_MIN_MS = Duration.toMillis('1 second');
const STREAM_RECONNECT_MAX_MS = Duration.toMillis('30 seconds');

type Target = { readonly agentId: ManagedId; readonly sessionId: ManagedId };
type Events = Parameters<ManagedClient['beta']['sessions']['events']['send']>[1]['events'];

type Dependencies = {
  readonly client: ManagedClient;
  readonly attention: (request: ReadRequest<'attention'>) => ManagedAttention | undefined;
  readonly history: (request: ReadRequest<'sessionEvents'>) => ManagedHistoryPage | undefined;
  readonly signal: AbortSignal;
  readonly signalForRead: (request: ReadRequest) => AbortSignal;
  readonly refresh: (request: ReadRequest) => Promise<void>;
  readonly refreshKind: (kind: ReadKind, owner?: string) => Promise<void>;
  readonly onFailure: (request: ReadRequest, error: unknown, signal: AbortSignal) => Promise<void>;
};

function message(text: string): Extract<Events[number], { readonly type: 'user.message' }> {
  return { type: 'user.message', content: [{ type: 'text', text }] };
}

export function createManagedCommands({
  client,
  signal,
  attention,
  history,
  signalForRead,
  refresh,
  refreshKind,
  onFailure,
}: Dependencies) {
  async function send(target: Target, events: Events): Promise<void> {
    const request = readRequests.session(target.agentId, target.sessionId);
    const commandSignal = signalForRead(request);

    try {
      await admitSession(client, target, commandSignal);
      await client.beta.sessions.events.send(target.sessionId, { events }, { signal: commandSignal });
    } catch (error) {
      await onFailure(request, error, commandSignal);

      throw error;
    }

    void Promise.allSettled([
      refresh(request),
      refreshKind('sessions', target.agentId),
      refreshKind('sessionEvents', target.agentId),
    ]);
  }

  return {
    attention,
    history,
    async archiveAgent(agentId: ManagedId) {
      const request = readRequests.agent(agentId);
      const commandSignal = signalForRead(request);

      try {
        await client.beta.agents.archive(agentId, {}, { signal: commandSignal });
      } catch (error) {
        await onFailure(request, error, commandSignal);

        throw error;
      }

      await Promise.allSettled([refresh(request), refreshKind('agents')]);
    },
    async archiveSession(target: Target) {
      const request = readRequests.session(target.agentId, target.sessionId);
      const commandSignal = signalForRead(request);

      try {
        await admitSession(client, target, commandSignal);
        await client.beta.sessions.archive(target.sessionId, {}, { signal: commandSignal });
      } catch (error) {
        await onFailure(request, error, commandSignal);

        throw error;
      }

      await Promise.allSettled([refresh(request), refreshKind('sessions', target.agentId)]);
    },
    async createAgent({
      name,
      model,
      system,
    }: {
      readonly name: string;
      readonly model: string;
      readonly system?: string;
    }) {
      const agent = await client.beta.agents.create(
        { name, model, ...(system === undefined ? {} : { system }) },
        { signal },
      );

      void Promise.allSettled([refreshKind('agents')]);

      return projectAgent(agent);
    },
    async createEnvironment({ name }: { readonly name: string }) {
      const environment = await client.beta.environments.create({ name, config: { type: 'self_hosted' } }, { signal });

      void Promise.allSettled([refreshKind('managedEnvironments')]);

      return { id: environment.id, name: environment.name, updatedAt: environment.updated_at };
    },
    async createSession({
      agentId,
      environmentId,
      title,
      firstMessage,
    }: {
      readonly agentId: ManagedId;
      readonly environmentId: ManagedId;
      readonly title?: string;
      readonly firstMessage?: string;
    }) {
      const request = readRequests.agent(agentId);

      const session = await client.beta.sessions.create(
        {
          agent: agentId,
          environment_id: environmentId,
          ...(title === undefined ? {} : { title }),
          ...(firstMessage === undefined ? {} : { initial_events: [message(firstMessage)] }),
        },
        { signal: signalForRead(request) },
      );

      void Promise.allSettled([refreshKind('sessions', agentId)]);

      return projectSession(session);
    },
    async sendMessage(input: Target & { readonly text: string }) {
      await send(input, [message(input.text)]);
    },
    async interrupt(input: Target) {
      await send(input, [{ type: 'user.interrupt' }]);
    },
    async confirmTool(input: Target & { readonly toolUseId: ManagedId; readonly result: 'allow' | 'deny' }) {
      await send(input, [{ type: 'user.tool_confirmation', tool_use_id: input.toolUseId, result: input.result }]);
    },
    async followEvents(request: ReadRequest<'sessionEvents'>, viewSignal: AbortSignal) {
      if (request.page !== null || request.through !== null) {
        return;
      }

      const streamSignal = AbortSignal.any([viewSignal, signalForRead(request)]);
      const options = { signal: streamSignal };
      const latest = readRequests.sessionEvents(request);
      const retry = { delayMs: STREAM_RECONNECT_MIN_MS };

      // A committed event resets the backoff. Polling and focus reads still work between connections.
      function isViewing() {
        return !streamSignal.aborted;
      }

      async function followConnection() {
        await admitSession(client, request, streamSignal);

        const stream =
          request.threadId === null
            ? await client.beta.sessions.events.stream(request.sessionId, {}, options)
            : await client.beta.sessions.threads.events.stream(
                request.threadId,
                { session_id: request.sessionId },
                options,
              );

        // Join the live subscription before reading history so a concurrent committed event cannot be missed.
        await refresh(latest);

        for await (const event of stream) {
          if ('id' in event) {
            retry.delayMs = STREAM_RECONNECT_MIN_MS;

            await refresh(latest);

            if (event.type.startsWith('session.status_')) {
              await Promise.all([
                refresh(readRequests.session(request.agentId, request.sessionId)),
                refresh(readRequests.sessionStatus(request.agentId, request.sessionId)),
                refresh(readRequests.attention(request.agentId)),
                refreshKind('sessions', request.agentId),
              ]);
            }
          }
        }
      }

      while (isViewing()) {
        try {
          await followConnection();
        } catch (error) {
          if (streamSignal.aborted) {
            return;
          }

          const status = managedStatus(error);

          const isClientFailure =
            status !== undefined &&
            status < HttpStatusCode.InternalServerError &&
            status !== HttpStatusCode.TooManyRequests;

          if (!canRetainResult(error) || isClientFailure) {
            await onFailure(request, error, streamSignal);

            throw error;
          }
        }

        await waitForRetry(retry.delayMs, streamSignal);

        retry.delayMs = Math.min(STREAM_RECONNECT_MAX_MS, retry.delayMs + retry.delayMs);
      }
    },
  };
}
