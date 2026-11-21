import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { isInstalledEnvironment, ManagedStoreError } from '@mechane/control-store';
import type { ControlStore, InstalledSession } from '@mechane/control-store';
import { ManagedRuntimeError } from '@mechane/model-gateway';
import { serialCalls } from '@mechane/utilities';
import { Record, Schema } from 'effect';
import { appendManagedEvent } from './event-log/write.ts';
import { ManagedWireObject } from './protocol.ts';
import type { ManagedEvent, ManagedSessionMutation } from './protocol.ts';
import { ActiveNativeSessions, DirtySessions, enqueue, release, sessionState } from './scheduler.ts';
import {
  lifecycleRequest,
  prepareSessionMutation,
  releaseSessionMutation,
  SessionMutation,
} from './session-lifecycle-records.ts';
import { readManagedSessionState } from './thread-state.ts';
import { archiveManagedSessionThreads, updateManagedThreadAgent } from './threads.ts';

type LifecycleOptions = {
  readonly harness: Harness;
  readonly workspaceId: string;
  readonly withControl: <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;
  readonly forwardMetadata: ReadonlyArray<string>;
  readonly validateBudgetModels: (agent: ManagedWireObject) => void;
  readonly eraseChildren: (sessionId: string) => Promise<void>;
  readonly destroyInstalledWorkspace: (scope: InstalledSession) => Promise<void>;
  readonly sealErasure: (sessionId: string, mutation?: ManagedSessionMutation) => Promise<void>;
  readonly onSessionDeleted?: ((event: ManagedEvent) => void) | undefined;
  readonly resumeBudget: (transaction: Tx, sessionId: string) => Promise<void>;
};

const toolList = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject));

async function acceptSessionUpdate(
  transaction: Tx,
  input: ManagedSessionMutation,
  update: { readonly document: ManagedWireObject; readonly resumeBudget: LifecycleOptions['resumeBudget'] },
) {
  const { document } = update;
  const changes = input.changes ?? {};
  const event: globalThis.Record<string, unknown> & { readonly type: string } = { type: 'session.updated' };

  if (Object.hasOwn(changes, 'title')) {
    event['title'] = document['title'] ?? null;
  }

  if (Object.hasOwn(changes, 'metadata')) {
    const metadata = Schema.decodeUnknownSync(ManagedWireObject)(document['metadata'] ?? {});

    if (Record.keys(metadata).length > 0) {
      event['metadata'] = metadata;
    }
  }

  if (Object.hasOwn(changes, 'agent')) {
    const state = await sessionState(transaction, input.sessionId);
    const agent = Schema.decodeUnknownSync(ManagedWireObject)(document['agent']);
    const tools = toolList(agent['tools']);
    const mcpServers = toolList(agent['mcp_servers']);

    await updateManagedThreadAgent(transaction, {
      sessionId: input.sessionId,
      threadId: state.threadId,
      tools,
      mcpServers,
    });

    state.tools = JSON.stringify(tools);
    state.mcpServers = JSON.stringify(mcpServers);
    event['agent'] = agent;
  }

  if (Object.hasOwn(changes, 'budget')) {
    event['budget'] = document['budget'] ?? null;
  }

  await appendManagedEvent(
    transaction,
    { sessionId: input.sessionId, stableKey: `session-update:${input.mutationId}` },
    event,
  );

  if (Object.hasOwn(changes, 'budget')) {
    await update.resumeBudget(transaction, input.sessionId);
  }
}

export function createManagedSessionLifecycle(options: LifecycleOptions) {
  const { harness } = options;
  const queue = serialCalls();

  async function mutate(input: ManagedSessionMutation): Promise<ManagedWireObject> {
    const prepared = await harness.commit(
      (transaction) => prepareSessionMutation(transaction, input),
      BACKGROUND_CONTEXT,
    );

    const scope = { workspaceId: options.workspaceId, principalId: input.principalId, isAdmin: input.isAdmin };

    const operation = {
      id: input.sessionId,
      mutationId: input.mutationId,
      kind: input.kind,
      scope,
      changes: input.changes ?? {},
      validateBudgetModels: options.validateBudgetModels,
      forwardMetadata: options.forwardMetadata,
    };

    const response = await options
      .withControl((store) => store.managed.sessions.applyMutation(operation))
      .catch(async (error: unknown) => {
        if (error instanceof ManagedStoreError || error instanceof ManagedRuntimeError) {
          if (!prepared.isCompleted) {
            await harness.commit(async (transaction) => {
              const state = await sessionState(transaction, input.sessionId);

              if (state.mutationId !== input.mutationId) {
                return;
              }

              state.mutationId = null;

              await releaseSessionMutation(transaction, input, { isApplied: false });

              if (state.status === 'running') {
                await enqueue(transaction, input.sessionId);
              }
            }, BACKGROUND_CONTEXT);
          }

          throw new ManagedRuntimeError({ status: error.status, message: error.message });
        }

        throw error;
      });

    const document = Schema.decodeUnknownSync(ManagedWireObject)(response.document);

    if (prepared.isCompleted) {
      if (prepared.status === null) {
        return document;
      }

      return { ...document, status: prepared.status };
    }

    if (input.kind === 'delete') {
      await options.eraseChildren(input.sessionId);

      const session = {
        workspaceId: options.workspaceId,
        environmentId: prepared.environmentId,
        sessionId: input.sessionId,
      };

      if (isInstalledEnvironment(session)) {
        await options.destroyInstalledWorkspace(session);
      }

      await options.sealErasure(input.sessionId, input);
    }

    const deleted: { event?: ManagedEvent } = {};

    const settled = await harness.commit(async (transaction) => {
      const state = await sessionState(transaction, input.sessionId);

      if (state.mutationId !== input.mutationId) {
        throw new Error('Session mutation lost its execution fence');
      }

      if (input.kind === 'delete') {
        state.isArchived = true;
        state.status = 'terminated';

        deleted.event = await appendManagedEvent(
          transaction,
          { sessionId: input.sessionId, stableKey: `session-delete:${input.mutationId}` },
          { type: 'session.deleted' },
        );

        await release(transaction, input.sessionId);
        await ActiveNativeSessions.remove(transaction, input.sessionId);
        await DirtySessions.remove(transaction, input.sessionId);
        await releaseSessionMutation(transaction, input, { isApplied: true, status: null });

        return document;
      }

      state.mutationId = null;

      if (input.kind === 'archive') {
        state.isArchived = true;
        state.status = 'terminated';
        state.stopReason = null;
        state.waiting = null;

        await archiveManagedSessionThreads(transaction, input.sessionId);
        await release(transaction, input.sessionId);
      } else {
        await acceptSessionUpdate(transaction, input, { document, resumeBudget: options.resumeBudget });

        if (state.status === 'running') {
          await enqueue(transaction, input.sessionId);
        }
      }

      const current = await readManagedSessionState(transaction, input.sessionId);

      await releaseSessionMutation(transaction, input, { isApplied: true, status: current.status });

      return { ...document, status: current.status };
    }, BACKGROUND_CONTEXT);

    if (deleted.event !== undefined) {
      options.onSessionDeleted?.(deleted.event);
    }

    return settled;
  }

  return {
    mutateSession: (input: ManagedSessionMutation) => queue.run({ run: () => mutate(input) }),
    recoverManagedMutations: () =>
      queue.run({
        run: async () => {
          const record = await harness.snapshot(SessionMutation, BACKGROUND_CONTEXT);

          if (record === undefined || record.request === '') {
            return;
          }

          try {
            await mutate(lifecycleRequest(record.request));
          } catch (error) {
            const retained = await harness.snapshot(SessionMutation, BACKGROUND_CONTEXT);

            if (!(error instanceof ManagedRuntimeError) || (retained !== undefined && retained.request !== '')) {
              throw error;
            }
          }
        },
      }),
  };
}
