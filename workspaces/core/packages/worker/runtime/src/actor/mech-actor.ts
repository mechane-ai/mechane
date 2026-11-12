import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createRegistry, defineExtension, GenerationTask, Harness, hook, LiveDoc } from '@earendil-works/pi-durable';
import type { Conversation, Registry, Tx, Wake } from '@earendil-works/pi-durable';
import { openDurableObjectSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import { openControlStore, StoreConflict } from '@mechane/control-store';
import type { ControlStore } from '@mechane/control-store';
import {
  ExpectedRoutineRevision,
  MechHistoryImportBatch,
  RequestConflict,
  RequestInvalid,
  RoutineRequest,
  ServerFailure,
  ServiceUnavailable,
} from '@mechane/protocol';
import { HttpStatusCode, RecordId } from '@mechane/records';
import { SandboxCompletion } from '@mechane/sandbox-wire';
import { serialCalls } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { Duration, Option, Redacted, Schema } from 'effect';
import { decodeStored, ExportRecord, NativeEntryId, NativeFields, RunRecord, StoredFields } from '../actor/records.ts';
import { loadRuntimeConfiguration, resolveRuntimeEnvironment } from '../config.ts';
import type { RuntimeConfiguration } from '../config.ts';
import { advanceCheckpoint } from '../execution/checkpoint.ts';
import { acceptCompletion } from '../execution/completion.ts';
import { createRuntimeModels } from '../models/metered-provider.ts';
import {
  admitInTransaction,
  admitNotification,
  appendEvent,
  notificationFingerprint,
  notificationsForInputs,
  pendingNotification,
  turnForNativeInputs,
} from '../notifications/admission.ts';
import { writeActorDeferred, writeActorOperationFailure, writeNativeReport } from '../output/write-actor-diagnostic.ts';
import { publishSelfMessage } from '../self/messages.ts';
import {
  deleteRoutine,
  listRoutines,
  observeRoutines,
  putRoutine,
  readRoutine,
  RoutineTask,
} from '../self/routines.ts';
import { cancelWake, listWakes, readWake, scheduleWake, SelfWakeTask } from '../self/wakes.ts';
import { createBashExecutionTask } from '../tools/bash-task.ts';
import type { BashExecutionTask } from '../tools/bash-task.ts';
import { createBrowserExecutionTask } from '../tools/browser/browser-task.ts';
import type { BrowserExecutionTask } from '../tools/browser/browser-task.ts';
import type { McpDiscovery } from '../tools/mcp-definitions.ts';
import { createPiTools, restorePiTools } from '../tools/pi-tools.ts';
import { createProcessAdmissionTask } from '../tools/processes/process-task.ts';
import type { ProcessAdmissionTask } from '../tools/processes/process-task.ts';
import { historyPage } from '../views/history.ts';
import { appendImportedHistory } from '../views/imported.ts';
import {
  listConsoleMessages,
  listEvents,
  listRuns,
  readCancellation,
  readRun,
  readTrace,
  synchronizeTurns,
} from '../views/projections.ts';
import { abortPendingCancellations, reconcileCancellations, requestRunCancellation } from './cancellation.ts';
import type {
  ActorControlChange,
  ActorExport,
  ActorHistoryImport,
  ActorHistoryImportReceipt,
  ActorStatus,
  MechScope,
} from './client.ts';
import {
  Attempts,
  Cancellations,
  ControlChanges,
  Effects,
  Events,
  Exports,
  ImportedCompletions,
  ImportedHistory,
  ImportedNotifications,
  ImportedRunPointers,
  Imports,
  Messages,
  Notifications,
  Observations,
  PendingAttempts,
  PendingCancellations,
  PendingEffects,
  PendingNotifications,
  putAttempt,
  putEffect,
  putTurn,
  Routines,
  SequenceNotifications,
  Turns,
  UnresolvedImportedEffects,
  Wakes,
} from './collections.ts';
import { acquireExportHold, quiesceActor, releaseExportHold } from './export-hold.ts';
import type { AttemptRecord } from './record-schemas.ts';
import { fingerprint, stableJson, State } from './state.ts';
import type { ActorState } from './state.ts';
import { openActorAlarmStore } from './store.ts';
import type { ActorAlarmStore } from './store.ts';
import { readToolConfiguration, writeToolConfiguration } from './tool-configuration.ts';
import type { ActorAccess, RuntimeBindings } from './types.ts';

const context = BACKGROUND_CONTEXT;
const recoveryMilliseconds = 1000;
const definitionRefreshRetry = Duration.seconds(30);
const definitionRefreshRetryMilliseconds = Duration.toMillis(definitionRefreshRetry);
const ROOT_MAX_TURNS = 32;
const PROVIDER_RETRY_MAX_ATTEMPTS = 2;
const COMPACTION_RESERVED_TOKENS = 4096;
const COMPACTION_RECENT_TOKENS = 8192;
const COMPACTION_BACKGROUND_TOKENS = 4096;
const COMPACTION_RESERVE_DIVISOR = 2;
const COMPACTION_RECENT_DIVISOR = 4;
const COMPACTION_BACKGROUND_DIVISOR = 8;
const releasableAttemptPhases: ReadonlySet<string> = new Set(['intent', 'reserved', 'release']);

function actorResource<T>(value: Option.Option<T>, name: string): T {
  if (Option.isNone(value)) {
    throw new Error(`The actor ${name} is not open`);
  }

  return value.value;
}

function initialRuntime() {
  return {
    harness: Option.none<Harness>(),
    conversation: Option.none<Conversation>(),
    registry: Option.none<Registry>(),
    bashTask: Option.none<BashExecutionTask>(),
    browserTask: Option.none<BrowserExecutionTask>(),
    processTask: Option.none<ProcessAdmissionTask>(),
    configuration: Option.none<RuntimeConfiguration>(),
    scope: Option.none<MechScope>(),
    isOpen: false,
    isDefinitionReady: false,
    isDiscoveryComplete: false,
    isDefinitionRefreshing: false,
    nextDefinitionRefreshAt: 0,
  };
}

async function prepareDefinitionTools(
  input: Parameters<typeof createPiTools>[0],
  configuration: McpDiscovery | undefined,
): Promise<Awaited<ReturnType<typeof createPiTools>>> {
  if (configuration === undefined || !input.shouldDiscoverMcp) {
    return await createPiTools(input);
  }

  return await restorePiTools({ ...input, configuration });
}

const Envelope = Schema.Struct({
  workspaceId: RecordId,
  mechId: RecordId,
  method: Schema.NonEmptyString,
  input: Schema.Record(Schema.String, Schema.Unknown),
});

const NotificationInput = Schema.Struct({
  id: RecordId,
  text: Schema.String,
  source: Schema.Struct({ name: Schema.String, eventId: Schema.String, url: Schema.optionalKey(Schema.String) }),
  producer: Schema.Union([
    Schema.Struct({ kind: Schema.Literal('member'), principalId: RecordId }),
    Schema.Struct({ kind: Schema.Literal('producer'), id: Schema.String }),
  ]),
  data: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  shouldPublishToConsole: Schema.optionalKey(Schema.Boolean),
});

function field(input: Readonly<Record<string, unknown>>, name: string): string {
  return Schema.decodeUnknownSync(Schema.String)(input[name]);
}

function numberField(input: Readonly<Record<string, unknown>>, name: string): number | undefined {
  if (input[name] === undefined) {
    return undefined;
  }

  return Schema.decodeUnknownSync(Schema.Number)(input[name]);
}

function optionalField(input: Readonly<Record<string, unknown>>, name: string): string | undefined {
  if (input[name] === undefined || input[name] === null) {
    return undefined;
  }

  return field(input, name);
}

export class MechActor extends DurableObject<RuntimeBindings> {
  readonly #runtime = initialRuntime();
  readonly #alarms: ActorAlarmStore;
  readonly #definitionCalls = serialCalls();

  get #harness(): Harness {
    return actorResource(this.#runtime.harness, 'harness');
  }
  get #conversation(): Conversation {
    return actorResource(this.#runtime.conversation, 'conversation');
  }
  get #registry(): Registry {
    return actorResource(this.#runtime.registry, 'registry');
  }
  get #bashTask(): BashExecutionTask {
    return actorResource(this.#runtime.bashTask, 'Bash task');
  }
  get #browserTask(): BrowserExecutionTask {
    return actorResource(this.#runtime.browserTask, 'browser task');
  }
  get #processTask(): ProcessAdmissionTask {
    return actorResource(this.#runtime.processTask, 'process admission task');
  }
  get #configuration(): RuntimeConfiguration {
    return actorResource(this.#runtime.configuration, 'configuration');
  }
  get #scope(): MechScope | null {
    return Option.getOrNull(this.#runtime.scope);
  }

  constructor(actorState: DurableObjectState, environment: RuntimeBindings) {
    super(actorState, environment);

    this.#alarms = openActorAlarmStore(actorState.storage);

    void actorState.blockConcurrencyWhile(async () => {
      const fallback = Date.now() + recoveryMilliseconds;

      await this.#alarms.ensureRecovery({ at: fallback });

      this.#runtime.configuration = Option.some(
        loadRuntimeConfiguration({ environment: await resolveRuntimeEnvironment({ environment }) }),
      );

      this.#runtime.registry = Option.some(createRegistry());
      this.#runtime.bashTask = Option.some(createBashExecutionTask(() => this.#access()));
      this.#runtime.browserTask = Option.some(createBrowserExecutionTask(() => this.#access()));
      this.#runtime.processTask = Option.some(createProcessAdmissionTask(() => this.#access()));

      this.#registry.install(
        defineExtension({
          name: 'mechane',
          tasks: [SelfWakeTask, RoutineTask, this.#bashTask, this.#browserTask, this.#processTask],
          hooks: [
            hook(GenerationTask, {
              beforeRequest: async (request, api) => {
                const generation = await this.#harness.getTask(api.taskId, context);

                if (generation === undefined || generation.state.status !== 'running') {
                  throw new Error('The provider request has no native generation');
                }

                const checkpoint = Schema.decodeUnknownSync(
                  Schema.Struct({ phase: Schema.Literal('request'), cutoff: NativeEntryId }),
                )(generation.state.checkpoint);

                const prepared = await this.#conversation.context(context, { at: checkpoint.cutoff });

                if (stableJson(prepared.messages) !== stableJson(request.messages)) {
                  throw new Error('The provider request differs from its native prepared context');
                }

                const ids = prepared.entries
                  .filter(
                    (entry, index) =>
                      entry.kind === 'mechane.notification' && (prepared.contributions[index]?.length ?? 0) > 0,
                  )
                  .map((entry) => Schema.decodeUnknownSync(Schema.Struct({ id: RecordId }))(entry.data).id);

                await this.#harness.commit(async (transaction) => {
                  const state = await transaction.doc(State);
                  const live = await transaction.doc(LiveDoc, this.#conversation.id);
                  const nativeInputs = live.run?.inputs ?? [];
                  const primary = await turnForNativeInputs(transaction, nativeInputs);

                  const notifications = await notificationsForInputs(transaction, nativeInputs);

                  for (const notification of notifications) {
                    await Notifications.put(transaction, notification.id, { ...notification, turnId: primary.id });
                  }

                  const coverage = { sequence: state.observedSequence };

                  while (coverage.sequence < state.notificationBaseSequence) {
                    const id = await SequenceNotifications.read(transaction, String(coverage.sequence + 1));

                    if (id === undefined || !ids.includes(RecordId.make(id))) {
                      break;
                    }

                    coverage.sequence += 1;
                  }

                  state.observedSequence = Math.max(state.observedSequence, coverage.sequence);

                  await Observations.put(transaction, String(api.taskId), {
                    ids,
                    sequence: coverage.sequence,
                    turnId: primary.id,
                    cutoff: checkpoint.cutoff,
                  });
                  await observeRoutines(transaction, ids, primary.id);

                  const run = decodeStored(RunRecord, primary.value);

                  if (run.startedAt === null) {
                    await appendEvent(transaction, {
                      type: 'activation.started',
                      runId: primary.id,
                      payload: { notificationIds: notifications.map((notification) => notification.id) },
                    });
                  }

                  const taskIds = [...primary.taskIds];

                  if (!taskIds.includes(api.taskId)) {
                    taskIds.push(api.taskId);
                  }

                  await putTurn(transaction, {
                    ...primary,
                    taskIds,
                    value: JSON.stringify({
                      ...run,
                      notificationIds: notifications.map((notification) => notification.id),
                      status: 'running',
                      startedAt: run.startedAt ?? new Date().toISOString(),
                      version: run.version + 1,
                    }),
                  });

                  await appendEvent(transaction, {
                    type: 'model.context',
                    runId: primary.id,
                    payload: {
                      generationTaskId: api.taskId,
                      cutoff: checkpoint.cutoff,
                      observedSequence: coverage.sequence,
                      notificationIds: ids,
                    },
                  });
                }, context);
              },
            }),
          ],
        }),
      );

      const models = createRuntimeModels(this.#configuration, () => this.#access());

      this.#runtime.harness = Option.some(
        await Harness.open(
          await openDurableObjectSqliteStorage(actorState.storage),
          {
            models,
            registry: this.#registry,
            settings: {
              restartLimit: Number.POSITIVE_INFINITY,
              steeringMode: 'all',
              afterFailedRun: 'continue',
              toolExecution: 'sequential',
              retry: { enabled: true, maxRetries: PROVIDER_RETRY_MAX_ATTEMPTS, baseDelayMs: 1000 },
              progress: { persistWithinMs: 1000 },
            },
            onWake: () => {
              void this.#reconcileWake(actorState);
            },
            onReport: (report) => {
              writeNativeReport(report);

              if (report.kind === 'storage_failed') {
                actorState.abort('The native actor storage failed');
              }
            },
          },
          context,
        ),
      );

      this.#runtime.isOpen = true;

      this.#runtime.conversation = Option.some(
        await this.#harness.root(context, {
          agent: {
            model: { provider: 'mechane', modelId: this.#configuration.defaultModel },
            maxTurns: ROOT_MAX_TURNS,
          },
        }),
      );

      const state = await this.#harness.snapshot(State, context);
      this.#runtime.scope = Option.fromNullishOr(state?.scope);

      if (this.#scope !== null) {
        await releaseExportHold(this.#access(), null);

        const configuration = await readToolConfiguration(this.#harness);

        if (configuration !== undefined) {
          await this.#configureDefinition(configuration);
        }
      }

      await this.#arm(false);

      if (this.#scope === null) {
        return;
      }

      await this.#recoverUndispatchedAttempts();
      await abortPendingCancellations(this.#access());
      await this.#finishResume();
      await this.#resumePending();
    });
  }

  async #reconcileWake(actorState: DurableObjectState): Promise<void> {
    try {
      await this.#arm(false);

      if (this.#scope !== null) {
        await synchronizeTurns(this.#access());
      }
    } catch {
      actorState.abort('The actor could not reconcile its durable wake');
    }
  }

  #access(): ActorAccess {
    if (this.#scope === null) {
      throw new Error('The mech actor has no scope');
    }

    return {
      harness: this.#harness,
      conversation: this.#conversation,
      scope: this.#scope,
      configuration: this.#configuration,
      withControl: async (operation) => await this.#withControl(operation),
      arm: async () => await this.#arm(true),
      isDefinitionReady: () => this.#runtime.isDefinitionReady,
    };
  }

  async #withControl<T>(operation: (store: ControlStore) => Promise<T>): Promise<T> {
    const store = await openControlStore({
      databaseUrl: Redacted.value(this.#configuration.databaseUrl),
      keyring: Redacted.value(this.#configuration.credentialKeyring),
      maxConnections: this.#configuration.maxConnections,
    });

    try {
      return await operation(store);
    } finally {
      await store.close();
    }
  }

  async #refreshDefinition(): Promise<boolean> {
    const refresh = this.#definitionCalls.run({
      run: async () => {
        this.#runtime.isDefinitionRefreshing = true;
        this.#runtime.isDiscoveryComplete = false;
        this.#runtime.nextDefinitionRefreshAt = Date.now() + definitionRefreshRetryMilliseconds;

        try {
          return await this.#configureDefinition();
        } finally {
          this.#runtime.isDefinitionRefreshing = false;
          this.#runtime.nextDefinitionRefreshAt = Date.now() + definitionRefreshRetryMilliseconds;
        }
      },
    });

    this.ctx.waitUntil(refresh);

    return await refresh;
  }

  async #configureDefinition(configuration?: McpDiscovery): Promise<boolean> {
    const access = this.#access();

    const { mech, policy } = await access.withControl(async (store) => ({
      mech: await store.getMech(access.scope),
      policy: await store.getRuntimePolicy(access.scope),
    }));

    const shouldDiscoverMcp = mech.status === 'active' && policy !== null && !policy.isSuspended;

    const prepared = await prepareDefinitionTools(
      {
        access,
        bashTask: this.#bashTask,
        browserTask: this.#browserTask,
        processTask: this.#processTask,
        shouldDiscoverMcp,
      },
      configuration,
    );

    const offer = this.#configuration.model.offers.find((candidate) => candidate.id === mech.model);

    if (offer === undefined) {
      throw new RequestInvalid({ reason: 'The selected model is unavailable' });
    }

    await this.#harness.commit(
      (transaction) => writeToolConfiguration({ transaction, configuration: prepared.configuration }),
      context,
    );
    this.#registry.install(defineExtension({ name: 'mechane-tools', tools: prepared.tools }));

    await this.#conversation.configure(
      {
        model: { provider: 'mechane', modelId: mech.model },
        instructions: [mech.instructions ?? '', ...prepared.configuration.notices].join('\n\n'),
        maxTurns: ROOT_MAX_TURNS,
        compaction: {
          enabled: true,
          reserveTokens: Math.min(
            offer.maxOutputTokens + COMPACTION_RESERVED_TOKENS,
            Math.floor(offer.contextWindowTokens / COMPACTION_RESERVE_DIVISOR),
          ),
          keepRecentTokens: Math.min(
            COMPACTION_RECENT_TOKENS,
            Math.floor(offer.contextWindowTokens / COMPACTION_RECENT_DIVISOR),
          ),
          backgroundTokens: Math.min(
            COMPACTION_BACKGROUND_TOKENS,
            Math.floor(offer.contextWindowTokens / COMPACTION_BACKGROUND_DIVISOR),
          ),
        },
      },
      context,
    );
    await this.#harness.commit(async (transaction) => {
      const state = await transaction.doc(State);
      state.activeRevision = mech.revision;
      state.isPolicyPaused = mech.status !== 'active' || policy === null || policy.isSuspended;
    }, context);

    this.#runtime.isDefinitionReady = true;
    this.#runtime.isDiscoveryComplete = prepared.configuration.isComplete;
    this.#runtime.nextDefinitionRefreshAt = Date.now() + definitionRefreshRetryMilliseconds;

    return prepared.configuration.isComplete;
  }

  async #hasReadyPendingNotifications(state: ActorState | undefined): Promise<boolean> {
    if (!this.#runtime.isDefinitionReady || state === undefined) {
      return false;
    }

    if (state.isQuiesced || state.isPolicyPaused || !state.isImportComplete) {
      return false;
    }

    if (state.isEnvironmentCheckpointRequired) {
      return false;
    }

    return (await PendingNotifications.count(this.#harness, context)) > 0;
  }

  async #arm(isRecovery: boolean): Promise<void> {
    if (this.#runtime.isOpen && (await PendingCancellations.count(this.#harness, context)) > 0) {
      const recoveryAt = Date.now() + recoveryMilliseconds;
      const wake: Wake = this.#harness.wake();

      await this.#alarms.ensureRecovery({ at: Math.min(recoveryAt, wake.at ?? recoveryAt) });

      return;
    }

    await this.#alarms.reconcile({
      next: async () => {
        if (!this.#runtime.isOpen) {
          return Date.now() + recoveryMilliseconds;
        }

        const wake: Wake = this.#harness.wake();
        const times: Array<number> = [];
        const current = await this.#harness.snapshot(State, context);

        if (this.#scope !== null && !this.#runtime.isDiscoveryComplete) {
          times.push(Math.max(Date.now() + recoveryMilliseconds, this.#runtime.nextDefinitionRefreshAt));
        }

        const hasSettlement = (await PendingAttempts.count(this.#harness, context)) > 0;

        const hasCheckpoint = current?.isResumePending === true && current.isEnvironmentCheckpointRequired;
        const hasNotifications = await this.#hasReadyPendingNotifications(current);

        const hasDeferredRecovery = hasSettlement || hasCheckpoint || hasNotifications;

        if (isRecovery || wake.active || hasDeferredRecovery) {
          times.push(Date.now() + recoveryMilliseconds);
        }

        if (wake.at !== undefined) {
          times.push(wake.at);
        }

        if (times.length === 0) {
          return null;
        }

        return Math.min(...times);
      },
    });
  }

  override async alarm(): Promise<void> {
    await this.#arm(true);

    if (this.#scope !== null) {
      await this.#settleAttempts();
      await reconcileCancellations(this.#access());
      await this.#resumePending();

      const isRefreshDue = !this.#runtime.isDiscoveryComplete && Date.now() >= this.#runtime.nextDefinitionRefreshAt;

      if (isRefreshDue && !this.#runtime.isDefinitionRefreshing) {
        try {
          await this.#refreshDefinition();
        } catch (error) {
          writeActorOperationFailure(error);
        }
      }
    }

    const state = await this.#harness.snapshot(State, context);

    if (state?.isResumePending === true && state.isEnvironmentCheckpointRequired) {
      try {
        await advanceCheckpoint(this.#access());
      } catch {
        writeActorDeferred({ kind: 'checkpoint' });
      }
    }

    await this.#finishResume();
    await this.#resumePending();
    await this.#arm(false);
  }

  async #pendingAttemptRecords(): Promise<ReadonlyArray<AttemptRecord>> {
    return await this.#harness.commit(async (transaction) => {
      const ids = await PendingAttempts.allInTransaction(transaction);
      const records: Array<AttemptRecord> = [];

      for (const id of ids) {
        const attempt = await Attempts.read(transaction, id);

        if (attempt === undefined) {
          throw new Error('The pending provider attempt is missing');
        }

        records.push(attempt);
      }

      return records;
    }, context);
  }

  async #settleAttempts(): Promise<void> {
    const access = this.#access();
    const pending = await this.#pendingAttemptRecords();

    for (const attempt of pending) {
      if (attempt.phase === 'release') {
        try {
          await this.#releaseAttempt(attempt.id);
        } catch {
          writeActorDeferred({ kind: 'release', attemptId: attempt.id });
        }
      } else if (attempt.phase === 'settlement' && attempt.actualMicros !== null && attempt.usage !== null) {
        try {
          await access.withControl((store) =>
            store.settleProviderAttempt({
              ...access.scope,
              id: attempt.id,
              requestFingerprint: attempt.fingerprint,
              actualMicros: Number(attempt.actualMicros),
              upstreamUsage: decodeStored(StoredFields, String(attempt.usage)),
            }),
          );
          await this.#harness.commit(async (transaction) => {
            const saved = await Attempts.read(transaction, attempt.id);

            if (saved !== undefined) {
              await putAttempt(transaction, { ...saved, phase: 'settled' });
            }
          }, context);
        } catch {
          writeActorDeferred({ kind: 'settlement', attemptId: attempt.id });
        }
      }
    }
  }

  async #recoverUndispatchedAttempts(): Promise<void> {
    const pending = await this.#pendingAttemptRecords();

    for (const attempt of pending) {
      if (releasableAttemptPhases.has(attempt.phase)) {
        await this.#releaseAttempt(attempt.id);
      }
    }
  }

  async #releaseAttempt(id: string): Promise<void> {
    const access = this.#access();
    const remote = await access.withControl((store) => store.getProviderAttempt({ ...access.scope, id }));

    if (remote?.state === 'reserved') {
      await access.withControl((store) =>
        store.releaseUnusedProviderAttempt({ ...access.scope, id, requestFingerprint: remote.requestFingerprint }),
      );
    }

    await this.#harness.commit(async (transaction) => {
      const saved = await Attempts.read(transaction, id);

      if (saved === undefined) {
        return;
      }

      let phase: typeof saved.phase = 'refused';

      if (remote?.state === 'dispatched') {
        phase = 'dispatched';
      }

      await putAttempt(transaction, {
        ...saved,
        phase,
        refusalReason: saved.refusalReason ?? remote?.refusalReason ?? null,
      });
    }, context);
  }

  override async fetch(request: Request): Promise<Response> {
    try {
      const envelope = Schema.decodeUnknownSync(Envelope)(await request.json());
      const scope = { workspaceId: envelope.workspaceId, mechId: envelope.mechId };

      if (this.#scope === null) {
        await this.#withControl((store) => store.getMech(scope));
        await this.#harness.commit(async (transaction) => {
          const state = await transaction.doc(State);
          state.scope = scope;
        }, context);

        this.#runtime.scope = Option.some(scope);

        await this.#arm(true);
      }

      if (stableJson(this.#scope) !== stableJson(scope)) {
        throw new RequestInvalid({ reason: 'The actor scope does not match its durable identity' });
      }

      const result = await this.#operate(envelope.method, envelope.input);

      await this.#settleAttempts();
      await this.#arm(false);

      return Response.json(result ?? null);
    } catch (error) {
      try {
        await this.#arm(false);
      } catch (alarmError) {
        writeActorOperationFailure(alarmError);
      }

      if (Schema.is(ServerFailure)(error)) {
        return Response.json(
          { failure: Schema.encodeSync(ServerFailure)(error) },
          { status: HttpStatusCode.BadRequest },
        );
      }

      if (error instanceof StoreConflict) {
        return Response.json(
          { failure: Schema.encodeSync(ServerFailure)(new RequestConflict({ reason: error.message })) },
          { status: HttpStatusCode.Conflict },
        );
      }

      writeActorOperationFailure(error);

      return Response.json(
        {
          failure: Schema.encodeSync(ServerFailure)(
            new ServiceUnavailable({ reason: 'The durable mech operation could not be completed' }),
          ),
        },
        { status: HttpStatusCode.Unavailable },
      );
    }
  }

  async #operate(method: string, input: Readonly<Record<string, unknown>>): Promise<unknown> {
    const access = this.#access();

    switch (method) {
      case 'admitNotification':
        return await admitNotification(
          access,
          Schema.decodeUnknownSync(NotificationInput)({ ...input, data: input['data'] ?? null }),
        );
      case 'status':
        return await this.#status();
      case 'listHistory':
        return await this.#history(input);
      case 'maintenance': {
        const action = field(input, 'action');

        if (action === 'quiesce') {
          await this.#quiesce();
        } else if (action === 'resume') {
          await this.#resume();
        } else {
          throw new RequestInvalid({ reason: 'The maintenance action is unknown' });
        }

        return await this.#maintenance();
      }
      case 'applyControlChange':
        return await this.#applyControlChange(
          Schema.decodeUnknownSync(
            Schema.Struct({
              id: RecordId,
              sourceSequence: Schema.Number,
              kind: Schema.String,
              revision: Schema.optionalKey(Schema.Number),
              payloadDigest: Schema.optionalKey(Schema.String),
            }),
          )(input),
        );
      case 'acceptCompletion':
        return await this.#acceptCompletion(Schema.decodeUnknownSync(SandboxCompletion)(input));
      case 'listRuns':
        return await listRuns(access, { after: optionalField(input, 'after'), maxRows: numberField(input, 'maxRows') });
      case 'readRun':
        return await readRun(access, { turnId: field(input, 'turnId') });
      case 'readTrace':
        return await readTrace(access, { turnId: field(input, 'turnId') });
      case 'cancelRun':
        return await requestRunCancellation(access, {
          turnId: field(input, 'turnId'),
          principalId: field(input, 'principalId'),
        });
      case 'readCancellation':
        return await readCancellation(access, { turnId: field(input, 'turnId') });
      case 'listEvents':
        return await listEvents(access, {
          afterSequence: numberField(input, 'afterSequence'),
          beforeSequence: numberField(input, 'beforeSequence'),
          isNewestFirst: input['isNewestFirst'] === true,
          runId: optionalField(input, 'runId'),
          maxRows: numberField(input, 'maxRows'),
        });
      case 'listConsoleMessages':
        return await listConsoleMessages(access, {
          afterSequence: numberField(input, 'afterSequence'),
          beforeSequence: numberField(input, 'beforeSequence'),
          maxRows: numberField(input, 'maxRows'),
        });
      case 'scheduleWake':
        return await scheduleWake(
          access,
          Schema.decodeUnknownSync(
            Schema.Struct({
              wakeId: RecordId,
              text: Schema.String,
              afterSeconds: Schema.optionalKey(Schema.Number),
              at: Schema.optionalKey(Schema.String),
            }),
          )(input),
        );
      case 'readWake':
        return await readWake(access, { wakeId: field(input, 'wakeId') });
      case 'listWakes':
        return await listWakes(access, {
          after: optionalField(input, 'after'),
          maxRows: numberField(input, 'maxRows'),
        });
      case 'cancelWake':
        return await cancelWake(access, { wakeId: field(input, 'wakeId') });
      case 'putRoutine':
        return await putRoutine(access, {
          ...Schema.decodeUnknownSync(Schema.toType(RoutineRequest))(input),
          routineId: field(input, 'routineId'),
          principalId: field(input, 'principalId'),
        });
      case 'readRoutine':
        return await readRoutine(access, { routineId: field(input, 'routineId') });
      case 'listRoutines':
        return await listRoutines(access, { after: optionalField(input, 'after') });
      case 'deleteRoutine':
        return await deleteRoutine(access, {
          routineId: field(input, 'routineId'),
          principalId: field(input, 'principalId'),
          expectedRevision: Schema.decodeUnknownSync(ExpectedRoutineRevision)(input['expectedRevision']),
        });
      case 'publishMessage':
        return await publishSelfMessage(
          access,
          Schema.decodeUnknownSync(
            Schema.Struct({
              messageId: RecordId,
              text: Schema.String,
              presentation: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
            }),
          )(input),
        );
      case 'quiesce':
        return await this.#quiesce();
      case 'resume':
        return await this.#resume();
      case 'exportContext':
        return await this.#exportContext({ requestId: optionalField(input, 'requestId') });
      case 'importContext':
        return await this.#importContext(input);
      case 'importHistory':
        return await this.#importHistory(Schema.decodeUnknownSync(MechHistoryImportBatch)(input));
      default:
        throw new RequestInvalid({ reason: 'The actor operation is unknown' });
    }
  }

  async #status(): Promise<ActorStatus> {
    await synchronizeTurns(this.#access());

    const state = await this.#harness.snapshot(State, context);
    const live = await this.#harness.snapshot(LiveDoc, this.#conversation.id, context);

    const run = await this.#harness.commit(async (transaction) => {
      if (live?.run !== undefined) {
        for (const notification of await notificationsForInputs(transaction, live.run.inputs)) {
          const turn = await Turns.read(transaction, notification.turnId);

          if (turn !== undefined) {
            return turn;
          }
        }
      }

      return null;
    }, context);

    let status: ActorStatus['status'] = 'running';

    if (live?.run === undefined) {
      status = 'idle';
    }

    if (state?.isPolicyPaused === true) {
      status = 'paused';
    }

    if (state?.isQuiesced === true) {
      status = 'quiesced';
    }

    return {
      ...this.#access().scope,
      activeRevision: state?.activeRevision ?? 1,
      turnId: run?.id ?? null,
      status,
      admittedSequence: state?.notificationBaseSequence ?? 0,
      observedSequence: state?.observedSequence ?? 0,
    };
  }

  async #hasActivePolicy(): Promise<boolean> {
    const access = this.#access();

    return await access.withControl(async (store) => {
      const mech = await store.getMech(access.scope);
      const policy = await store.getRuntimePolicy(access.scope);

      return mech.status === 'active' && policy !== null && !policy.isSuspended;
    });
  }

  async #maintenance() {
    const status = await this.#status();
    const state = await this.#harness.snapshot(State, context);
    const inspection = await this.#harness.inspect(context);
    const permitted = await this.#hasActivePolicy();

    const isCheckpointRequired = state?.isEnvironmentCheckpointRequired ?? false;
    const isImportComplete = state?.isImportComplete ?? true;

    return {
      ...status,
      pendingNativeTaskCount: inspection.tasks.length,
      pendingEffectCount:
        (await PendingEffects.count(this.#harness, context)) +
        (await PendingCancellations.count(this.#harness, context)) +
        Number(state?.isResumePending === true && isCheckpointRequired),
      isCheckpointRequired,
      isImportComplete,
      canResume: permitted && isImportComplete && !isCheckpointRequired,
    };
  }

  async #history(input: Readonly<Record<string, unknown>>) {
    return await historyPage(this.#access(), {
      after: optionalField(input, 'after'),
      maxRows: numberField(input, 'maxRows'),
    });
  }

  async #applyControlChange(input: ActorControlChange): Promise<void> {
    const digest = input.payloadDigest ?? (await fingerprint(input));

    await this.#harness.commit(async (transaction) => {
      const state = await transaction.doc(State);
      const existing = await ControlChanges.read(transaction, input.id);

      if (existing !== undefined && existing.digest !== digest) {
        throw new StoreConflict('The control change identity has different content');
      }

      if (existing === undefined) {
        await ControlChanges.put(transaction, input.id, { id: input.id, digest });
      }

      state.controlSequence = Math.max(state.controlSequence, input.sourceSequence);
    }, context);

    const isComplete = await this.#refreshDefinition();

    await this.#arm(true);
    await this.#finishResume();
    await this.#resumePending();

    if (!isComplete) {
      throw new ServiceUnavailable({ reason: 'The granted tool definitions could not be refreshed' });
    }
  }

  async #acceptCompletion(completion: SandboxCompletion): Promise<void> {
    await acceptCompletion(this.#access(), completion);
  }

  async #quiesce(): Promise<void> {
    await quiesceActor(this.#access());
  }

  async #resume(): Promise<void> {
    const access = this.#access();

    await this.#refreshDefinition();

    if (!(await this.#hasActivePolicy())) {
      throw new RequestInvalid({ reason: 'The mech or workspace remains paused' });
    }

    const before = await this.#harness.snapshot(State, context);

    if (before?.exportHold !== null && before?.exportHold !== undefined) {
      throw new RequestConflict({ reason: 'The context export must finish before resuming' });
    }

    if (before?.isImportComplete === false) {
      throw new RequestInvalid({ reason: 'The state import is incomplete' });
    }

    await this.#arm(true);

    if (before?.isEnvironmentCheckpointRequired === true) {
      await this.#harness.commit(async (transaction) => {
        const state = await transaction.doc(State);
        const live = await transaction.doc(LiveDoc, this.#conversation.id);

        if (live.run !== undefined) {
          throw new RequestInvalid({ reason: 'The environment barrier requires an idle mech' });
        }

        if (state.exportHold !== null) {
          throw new RequestConflict({ reason: 'The context export must finish before resuming' });
        }

        if (!state.isResumePending) {
          state.checkpointBarrier = null;
        }

        state.isQuiesced = true;
        state.isResumePending = true;
      }, context);

      if (!(await advanceCheckpoint(access))) {
        return;
      }

      await this.#finishResume();
    } else {
      await this.#harness.commit(async (transaction) => {
        const state = await transaction.doc(State);

        if (state.exportHold !== null) {
          throw new RequestConflict({ reason: 'The context export must finish before resuming' });
        }

        state.isQuiesced = false;
      }, context);
    }

    await this.#resumePending();
  }

  async #finishResume(): Promise<void> {
    const state = await this.#harness.snapshot(State, context);

    if (state?.isResumePending !== true || state.isEnvironmentCheckpointRequired || !state.isImportComplete) {
      return;
    }

    const allowed = await this.#hasActivePolicy();

    if (!allowed) {
      return;
    }

    await this.#harness.commit(async (transaction) => {
      const current = await transaction.doc(State);

      if (!current.isResumePending || current.isEnvironmentCheckpointRequired || !current.isImportComplete) {
        return;
      }

      if (current.exportHold !== null) {
        return;
      }

      current.isResumePending = false;
      current.isQuiesced = false;
    }, context);
  }

  async #releasePendingNotification(value: string): Promise<boolean> {
    const pending = pendingNotification(value);
    const digest = pending.digest ?? (await notificationFingerprint(pending.notification));

    return await this.#harness.commit(async (transaction) => {
      const current = await transaction.doc(State);

      if (current.isQuiesced || current.isPolicyPaused || !current.isImportComplete) {
        return false;
      }

      if (current.isEnvironmentCheckpointRequired) {
        return false;
      }

      await admitInTransaction({
        transaction,
        conversation: this.#conversation,
        notification: pending.notification,
        digest,
        receivedAt: pending.retained.receivedAt,
        receivedSequence: pending.retained.receivedSequence,
        isRelease: true,
      });

      return true;
    }, context);
  }

  async #releasePendingPage(offset: number) {
    const page = await PendingNotifications.page(this.#harness, { offset }, context);

    for (const value of page.items) {
      if (!(await this.#releasePendingNotification(value))) {
        return { ...page, isReleased: false };
      }
    }

    return { ...page, isReleased: true };
  }

  async #resumePending(): Promise<void> {
    if (!this.#runtime.isDefinitionReady) {
      return;
    }

    this.#harness.resume();

    const state = await this.#harness.snapshot(State, context);

    if (state?.isQuiesced === true || state?.isPolicyPaused === true || state?.isImportComplete === false) {
      return;
    }

    if (state?.isEnvironmentCheckpointRequired === true) {
      return;
    }

    const cursor = { offset: 0, hasMore: true };

    while (cursor.hasMore) {
      const page = await this.#releasePendingPage(cursor.offset);

      if (!page.isReleased) {
        return;
      }

      cursor.offset = page.nextOffset;
      cursor.hasMore = page.hasMore;
    }
  }

  async #exportContext(input: { readonly requestId?: string | undefined }): Promise<ActorExport> {
    const access = this.#access();
    const requestId = input.requestId ?? crypto.randomUUID();
    const existing = await acquireExportHold(access, requestId);

    if (existing !== null) {
      return existing;
    }

    try {
      const prepared = await this.#conversation.context(context);

      return await this.#harness.commit(async (transaction) => {
        const current = await transaction.doc(State);

        const exported: ActorExport = {
          version: 1,
          source: access.scope,
          exportedAt: new Date().toISOString(),
          sourceSequence: current.eventBaseSequence + (await Events.totalInTransaction(transaction)),
          definitionRevision: current.activeRevision,
          context: JSON.stringify(prepared.messages),
        };

        await Exports.put(transaction, requestId, { id: requestId, value: JSON.stringify(exported) });

        return exported;
      }, context);
    } finally {
      await releaseExportHold(access, requestId);
    }
  }

  static async #requireEmptyTarget(transaction: Tx): Promise<void> {
    for (const collection of [
      Notifications,
      PendingNotifications,
      Turns,
      Events,
      Messages,
      Effects,
      Attempts,
      Cancellations,
      Wakes,
      Routines,
      Imports,
      Exports,
      Observations,
      ImportedHistory,
      ImportedNotifications,
      ImportedCompletions,
    ]) {
      if ((await collection.countInTransaction(transaction)) > 0) {
        throw new RequestInvalid({
          reason: 'History import requires an empty target; accepted target data was preserved',
        });
      }
    }
  }

  async #importContext(input: Readonly<Record<string, unknown>>): Promise<void> {
    const requestId = field(input, 'requestId');
    const exported = Schema.decodeUnknownSync(ExportRecord)(input['exported']);
    const digest = await fingerprint(input);

    await this.#harness.commit(async (transaction) => {
      const state = await transaction.doc(State);
      const previous = await Imports.read(transaction, requestId);

      if (previous !== undefined) {
        if (previous.digest !== digest) {
          throw new StoreConflict('The imported context identity has changed');
        }

        return;
      }

      if (state.exportHold !== null) {
        throw new RequestConflict({ reason: 'The context export must finish before importing' });
      }

      const live = await transaction.doc(LiveDoc, this.#conversation.id);

      if (live.run !== undefined) {
        throw new RequestInvalid({ reason: 'Context can only be imported into an idle mech' });
      }

      await MechActor.#requireEmptyTarget(transaction);

      await this.#conversation.submit(transaction, {
        type: 'write',
        requestId,
        entry: {
          kind: 'mechane.imported-context',
          data: Schema.decodeUnknownSync(NativeFields)({
            source: exported.source,
            sourceSequence: exported.sourceSequence,
            definitionRevision: exported.definitionRevision,
            exportedAt: exported.exportedAt,
          }),
          model: [
            {
              role: 'user',
              content: `Read-only working context forked from mech ${exported.source.mechId} at source sequence ${exported.sourceSequence}. Full history remains readable on that source mech. Historical tool calls are records and must not be replayed.\n${exported.context}`,
              timestamp: Date.now(),
            },
          ],
        },
      });
      await Imports.put(transaction, requestId, { id: requestId, digest });
    }, context);
  }

  async #importHistory(input: ActorHistoryImport): Promise<ActorHistoryImportReceipt> {
    const digest = await fingerprint(input);
    const receipt = { sourceDigest: input.sourceDigest, sourceSequence: input.sourceSequence, isFinal: input.isFinal };
    const access = this.#access();

    const importAllowed = await access.withControl(async (store) => {
      const mech = await store.getMech(access.scope);
      const policy = await store.getRuntimePolicy(access.scope);

      return mech.status !== 'active' || policy?.isSuspended === true;
    });

    await this.#harness.commit(async (transaction) => {
      const state = await transaction.doc(State);
      const previous = await Imports.read(transaction, input.requestId);

      if (previous !== undefined) {
        if (previous.digest !== digest) {
          throw new StoreConflict('The imported batch identity has changed');
        }

        return;
      }

      if (state.exportHold !== null) {
        throw new RequestConflict({ reason: 'The context export must finish before importing history' });
      }

      const live = await transaction.doc(LiveDoc, this.#conversation.id);

      if (live.run !== undefined || (!state.isQuiesced && !importAllowed)) {
        throw new RequestInvalid({ reason: 'Preserved history requires an idle target under maintenance' });
      }

      if (state.importSequence === 0) {
        await MechActor.#requireEmptyTarget(transaction);
      }

      if (state.importSequence !== input.expectedSequence || input.sourceSequence !== input.expectedSequence + 1) {
        throw new StoreConflict('The imported batch cursor is not contiguous');
      }

      if (state.importDigest !== null && state.importDigest !== input.sourceDigest) {
        throw new StoreConflict('The imported source manifest changed');
      }

      state.isQuiesced = true;

      if (input.context !== null || input.workingContext !== null) {
        if (input.expectedSequence !== 0) {
          throw new RequestInvalid({ reason: 'Only the first import batch can carry working context' });
        }

        const seed = input.workingContext ?? JSON.stringify(input.context?.modelMessages ?? []);

        await this.#conversation.submit(transaction, {
          type: 'write',
          requestId: input.requestId,
          entry: {
            kind: 'mechane.imported-context',
            data: { sourceDigest: input.sourceDigest },
            model: [
              {
                role: 'user',
                content: `Imported working context with source manifest ${input.sourceDigest}. Historical tool calls remain read-only records and must not be replayed.\n${seed}`,
                timestamp: Date.now(),
              },
            ],
          },
        });
      }

      if (input.context !== null) {
        state.notificationBaseSequence = input.context.receivedSequence;
        state.observedSequence = input.context.presentedSequence;
        state.isEnvironmentCheckpointRequired = input.context.isEnvironmentCheckpointRequired;
      }

      for (const notification of input.notifications) {
        if (notification.workspaceId !== access.scope.workspaceId || notification.mechId !== access.scope.mechId) {
          throw new RequestInvalid({ reason: 'The imported notification belongs to another mech' });
        }

        const existing = await ImportedNotifications.read(transaction, notification.id);

        if (existing !== undefined && stableJson(existing) !== stableJson(notification)) {
          throw new StoreConflict('The preserved notification payload changed');
        }

        await ImportedNotifications.put(transaction, notification.id, notification);

        state.notificationBaseSequence = Math.max(state.notificationBaseSequence, notification.receivedSequence);

        if (existing === undefined && notification.receivedSequence > state.observedSequence) {
          await PendingNotifications.put(transaction, notification.id, JSON.stringify(notification));
        }
      }

      for (const execution of input.executions) {
        const existing = await Effects.read(transaction, execution.id);

        const request: string | null = (() => {
          if (execution.request === null) {
            return null;
          }

          return JSON.stringify(execution.request);
        })();

        const result: string | null = (() => {
          if (execution.result === null) {
            return null;
          }

          return JSON.stringify(execution.result);
        })();

        const saved = { ...execution, runtimeSource: 'imported' as const, request, result };

        if (existing !== undefined && stableJson(existing) !== stableJson(saved)) {
          throw new StoreConflict('The preserved execution receipt changed');
        }

        if (existing === undefined) {
          await putEffect(transaction, saved);
          await UnresolvedImportedEffects.put(transaction, saved.id, saved.id);
        }
      }

      for (const entry of Schema.decodeUnknownSync(Schema.Array(NativeFields))(input.history)) {
        const sequences = await appendImportedHistory(transaction, access.scope, entry);
        state.eventBaseSequence = Math.max(state.eventBaseSequence, sequences.eventSequence);
        state.messageBaseSequence = Math.max(state.messageBaseSequence, sequences.messageSequence);
      }

      await Imports.put(transaction, input.requestId, { id: input.requestId, digest });

      state.importSequence = input.sourceSequence;
      state.importDigest = input.sourceDigest;
      state.isImportComplete = input.isFinal;

      if (input.isFinal) {
        for (const id of await UnresolvedImportedEffects.allInTransaction(transaction)) {
          const effect = await Effects.read(transaction, id);

          if (effect === undefined || (await ImportedRunPointers.read(transaction, effect.runId)) === undefined) {
            throw new RequestInvalid({ reason: 'An imported execution has no preserved owning turn' });
          }

          await UnresolvedImportedEffects.remove(transaction, id);
        }

        await appendEvent(transaction, { type: 'history.imported', runId: null, payload: receipt });
      }
    }, context);

    return receipt;
  }
}
