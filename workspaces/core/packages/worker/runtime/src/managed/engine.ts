import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Context } from '@earendil-works/chord/context';
import { configure, Harness, ProviderDoc } from '@earendil-works/pi-durable';
import type { Storage, Tx } from '@earendil-works/pi-durable';
import type { ManagedIdentitySlot } from '@mechane/agent-slot';
import { HttpStatusCode } from '@mechane/records';
import { serialCalls } from '@mechane/utilities';
import type { InstalledWorkerWake, WithControl } from '../actor/types.ts';
import type { RuntimeConfiguration } from '../config.ts';
import { pinnedModelSettings } from '../models/managed-options.ts';
import { destroySessionWorkspace } from '../tools/managed-sandbox-work.ts';
import { acceptInputs, preflightManagedEvents } from './admission.ts';
import { advanceManagedFocus } from './advance-focus.ts';
import { assertManagedBudgetModels } from './budget-models.ts';
import { resumeManagedBudget } from './budget-resume.ts';
import { advanceDelegations } from './delegation/dispatch.ts';
import type { ResolveDelegationTarget } from './delegation/dispatch.ts';
import { eraseDelegatedChildren } from './delegation/retire.ts';
import { encodeCoordinatorRoster } from './delegation/roster.ts';
import { openNativeLifetime } from './engine-lifetime.ts';
import { managedWakeDeadline } from './engine-wake.ts';
import { createExecutionGate } from './execution-gate.ts';
import { failManagedRequest } from './failure.ts';
import { transition } from './lifecycle.ts';
import { managedModelSpans } from './model-spans.ts';
import { hydrateNativeCompaction } from './native-compaction.ts';
import { managedOutcomeConversation } from './outcomes.ts';
import type { ManagedToolCall } from './pi-tools.ts';
import { createGenerationRegistry } from './preview-output.ts';
import type {
  ManagedAgentScope,
  ManagedEvent,
  ManagedSessionMutation,
  ManagedSessionOpen,
  ManagedSessionSend,
  ManagedSessionThreadReference,
  ManagedWireObject,
} from './protocol.ts';
import type { ManagedExecution } from './provider-types.ts';
import { createManagedModels } from './provider.ts';
import { ActiveNativeSessions, choose, Sessions, sessionState, Slot } from './scheduler.ts';
import { createSessionExtensions } from './session-extension.ts';
import { createManagedSessionLifecycle } from './session-lifecycle.ts';
import { createManagedSessionView } from './session-view.ts';
import { registerManagedPrimary } from './thread-registration.ts';
import { abortRetiredFocus } from './thread-retirement.ts';
import { archiveManagedThread } from './threads.ts';
import { managedToolPermission } from './tools/auto-policy.ts';
import { resolveManagedWebServerTools } from './tools/web-server-tools.ts';
import { managedUsageProjector } from './usage-projection.ts';
import { reconcileWorkerDemand } from './worker-demand.ts';

type StartOptions = {
  readonly storage: Storage;
  readonly scope: ManagedAgentScope;
  readonly configuration: RuntimeConfiguration;
  readonly identitySlot: ManagedIdentitySlot;
  readonly sealErasure: (sessionId: string, mutation?: ManagedSessionMutation) => Promise<void>;
  readonly onSessionDeleted?: ((event: ManagedEvent) => void) | undefined;
  readonly withControl: WithControl;
  readonly wake: () => void;
  readonly wakeInstalledSession: InstalledWorkerWake;
  readonly waitUntil: (pending: Promise<void>) => void;
  readonly delegate?: ResolveDelegationTarget;
};

const PUMP_MAX_STEP_COUNT = 32;

export async function startManagedSessionEngine(options: StartOptions) {
  const pumps = serialCalls();
  const identity = createExecutionGate(options.identitySlot, currentExecution);

  const generations = createGenerationRegistry();

  const extensions = createSessionExtensions({
    generations,
    configuration: options.configuration,
    scope: options.scope,
    withControl: options.withControl,
    wake: options.wake,
    harness: (): Harness => harness,
    identity,
    evaluate: evaluatePermission,
  });

  const modelSpans = managedModelSpans({
    generations,
    harness: (): Harness => harness,
    withControl: options.withControl,
    workspaceId: options.scope.workspaceId,
  });

  const models = createManagedModels({
    configuration: options.configuration,
    workspaceId: options.scope.workspaceId,
    withControl: options.withControl,
    beginModelSpan: modelSpans.begin,
    hydrateCompaction: (input) => hydrateNativeCompaction(harness, input, context),
    withRequest: identity.withRequest,
  });

  const harness: Harness = await Harness.open(
    options.storage,
    {
      models,
      registry: extensions.registry,
      settings: {
        toolExecution: 'sequential',
        afterFailedRun: 'keep',
        restartLimit: Number.POSITIVE_INFINITY,
        compaction: { backgroundTokens: 0 },
        retry: { enabled: true, maxRetries: 2, baseDelayMs: 1000 },
      },
      onWake: () => options.wake(),
    },
    context,
  );

  const lifetime = openNativeLifetime(harness, options.waitUntil);

  await modelSpans.recover();

  const flushUsage = managedUsageProjector({
    harness,
    workspaceId: options.scope.workspaceId,
    withControl: options.withControl,
  });

  const view = createManagedSessionView({
    harness,
    workspaceId: options.scope.workspaceId,
    withControl: options.withControl,
    flushUsage,
  });

  const lifecycle = createManagedSessionLifecycle({
    harness,
    workspaceId: options.scope.workspaceId,
    withControl: options.withControl,
    forwardMetadata: options.configuration.model.credentials.forwardMetadata,
    validateBudgetModels: (agent) => assertManagedBudgetModels(options.configuration, agent),
    destroyInstalledWorkspace: async (scope) => {
      if (options.configuration.sandbox.provider !== 'cloudflare') {
        return;
      }

      const erased = await destroySessionWorkspace({ ...scope, sandbox: options.configuration.sandbox });

      if (!erased) {
        failManagedRequest(HttpStatusCode.Unavailable, 'Workspace erasure is still in progress.');
      }
    },
    eraseChildren: (sessionId) => eraseDelegatedChildren(harness, sessionId, options.delegate),
    sealErasure: options.sealErasure,
    onSessionDeleted: options.onSessionDeleted,
    resumeBudget: resumeManagedBudget,
  });

  for (const id of await ActiveNativeSessions.all(harness)) {
    const state = await harness.snapshot(Sessions, id, context);

    if (state !== undefined) {
      extensions.install(state, state);
    }
  }

  async function evaluatePermission(call: ManagedToolCall, toolContext: Context) {
    return await managedToolPermission({
      harness,
      call,
      context: toolContext,
      provider: {
        configuration: options.configuration,
        workspaceId: options.scope.workspaceId,
        withControl: options.withControl,
        beginModelSpan: modelSpans.begin,
        current: async () => {
          const execution = await currentExecution();

          if (execution.sessionId !== call.sessionId && execution.threadId !== call.sessionId) {
            throw new Error('The active conversation no longer owns this tool.');
          }

          return { ...execution, epoch: await identity.currentEpoch() };
        },
      },
    });
  }

  async function currentExecution(): Promise<ManagedExecution> {
    return await harness.commit(async (transaction) => {
      const slot = await transaction.doc(Slot);

      if (slot.owner === null) {
        throw new Error('No session owns the execution slot');
      }

      const state = await sessionState(transaction, slot.owner);

      if (state.activeEvent === null || state.activation === null || state.conversation === null) {
        throw new Error('No active execution owns the conversation');
      }

      if (state.interrupt !== null || state.waiting !== null || state.isArchived) {
        throw new Error('The active session cannot dispatch');
      }

      const conversationId = await managedOutcomeConversation(transaction, state);
      const native = await transaction.doc(ProviderDoc, conversationId);
      let webTools: ReadonlyArray<Readonly<Record<string, unknown>>> = [];

      if (conversationId === state.conversation) {
        webTools = resolveManagedWebServerTools(state.tools, options.configuration.managedWeb);
      }

      return {
        runtimeMechId: state.runtimeMechId,
        sessionId: state.publicSessionId,
        threadId: state.threadId,
        eventId: state.activeEvent,
        epoch: slot.epoch,
        model: state.model,
        speed: state.speed,
        effort: state.effort ?? undefined,
        activationId: state.activation,
        providerSessionId: native.sessionId,
        webTools,
      };
    }, context);
  }

  async function open(
    input: ManagedSessionOpen,
    publicSessionId = input.sessionId,
    admitOrigin?: (transaction: Tx) => Promise<void>,
  ) {
    const events = preflightManagedEvents(input.initialEvents, true);

    const instructions = [input.system, input.memoryInstructions ?? '', input.skillInstructions ?? '']
      .filter((value) => value.length > 0)
      .join('\n\n');

    const tools = JSON.stringify(input.tools);
    const isBudgetReached = events.length > 0 && (await readBudgetScope(publicSessionId));

    await harness.commit(async (transaction) => {
      await admitOrigin?.(transaction);

      const state = await transaction.doc(Sessions, input.sessionId, null);

      if (state.id !== '') {
        if (
          state.publicSessionId !== publicSessionId ||
          state.threadId !== input.threadId ||
          state.runtimeMechId !== input.runtimeMechId
        ) {
          failManagedRequest(HttpStatusCode.Conflict, 'Session belongs to another execution');
        }

        return;
      }

      await registerManagedPrimary(transaction, input);

      const coordinator = encodeCoordinatorRoster(input);

      const projection = {
        publicSessionId,
        threadId: input.threadId,
        mcpServers: JSON.stringify(input.mcpServers ?? []),
        mcpDescriptors: '[]',
      };

      const extension = extensions.install({ id: input.sessionId, tools, coordinator }, projection);
      const native = await transaction.createConversation({ ownership: { kind: 'ownerless' } });

      Object.assign(state, {
        id: input.sessionId,
        publicSessionId,
        threadId: input.threadId,
        runtimeMechId: input.runtimeMechId,
        environmentId: input.environmentId,
        conversation: native.id,
        model: input.model,
        ...pinnedModelSettings({ value: input.agent['model'], expectedId: input.model }),
        instructions,
        tools,
        coordinator,
        mcpServers: projection.mcpServers,
      });
      await configure(transaction, native.id, {
        model: { provider: 'mechane', modelId: input.model },
        instructions,
        extensions: [extension],
        maxTurns: null,
      });

      if (events.length > 0) {
        await acceptInputs(
          transaction,
          { sessionId: input.sessionId, threadId: input.threadId, isBudgetReached },
          events,
        );
      } else {
        await transition(transaction, {
          sessionId: input.sessionId,
          status: 'idle',
          reason: { type: 'end_turn' },
          isForced: true,
        });
      }
    }, context);
    options.wake();

    return await view.read(input);
  }

  async function readBudgetScope(sessionId: string): Promise<boolean> {
    await flushUsage();

    const { reached } = await options.withControl((store) =>
      store.getManagedSessionUsage({ workspaceId: options.scope.workspaceId, sessionId }),
    );

    return reached;
  }

  async function send(input: ManagedSessionSend) {
    const events = preflightManagedEvents(input.events);

    async function tryAdmission() {
      const previous = await harness.commit(async (transaction) => {
        const state = await sessionState(transaction, input.sessionId);

        return { publicId: state.publicSessionId, revision: state.budgetRevision };
      }, context);

      const reached = await readBudgetScope(previous.publicId);

      return await harness.commit(async (transaction) => {
        const state = await sessionState(transaction, input.sessionId);

        if (state.budgetRevision !== previous.revision) {
          return null;
        }

        return await acceptInputs(
          transaction,
          {
            sessionId: input.sessionId,
            threadId: input.threadId,
            workerLeaseId: input.workerLeaseId,
            isBudgetReached: reached,
          },
          events,
        );
      }, context);
    }

    for (let admitted = await tryAdmission(); ; admitted = await tryAdmission()) {
      if (admitted !== null) {
        options.wake();

        return admitted;
      }
    }
  }

  async function archiveThread(input: ManagedSessionThreadReference) {
    await harness.commit((transaction) => archiveManagedThread(transaction, input), context);

    options.wake();

    return await view.thread(input);
  }

  async function mutateSession(input: ManagedSessionMutation): Promise<ManagedWireObject> {
    try {
      return await lifecycle.mutateSession(input);
    } finally {
      options.wake();
    }
  }

  async function pollDelegations() {
    if (options.delegate === undefined) {
      return null;
    }

    return await advanceDelegations({ harness, target: options.delegate });
  }

  async function pump(): Promise<number | null> {
    return await pumps.run({
      run: async () => {
        await lifecycle.recoverManagedMutations();
        await abortRetiredFocus(harness);

        for (let step = 0; step < PUMP_MAX_STEP_COUNT; step += 1) {
          const id = await harness.commit(choose, context);

          if (id === null) {
            break;
          }

          if (
            !(await advanceManagedFocus(
              {
                harness,
                extensions,
                exclusive: identity.run,
                readBudgetScope: (sessionId) => readBudgetScope(sessionId),
              },
              id,
            ))
          ) {
            break;
          }
        }

        lifetime.resume();
        await view.project();

        const delegationWake = await pollDelegations();

        const workerWake = await reconcileWorkerDemand({
          harness,
          wakeInstalledSession: options.wakeInstalledSession,
          workspaceId: options.scope.workspaceId,
          withControl: options.withControl,
        });

        return await managedWakeDeadline(harness, [delegationWake, workerWake]);
      },
    });
  }

  return {
    harness,
    options,
    open,
    send,
    readBudgetScope,
    archiveThread,
    mutateSession,
    read: view.read,
    thread: view.thread,
    threads: view.threads,
    changes: view.changes,
    events: view.events,
    tail: view.tail,
    pump,
    canPark: lifetime.canPark,
    close: lifetime.close,
  };
}

export type ManagedAgentEngine = Awaited<ReturnType<typeof startManagedSessionEngine>>;
