import {
  CONSOLE_STORAGE_OPERATION_TIMEOUT_MS,
  ConsoleStorageFailed,
  ConsoleStorageStage,
  createConsoleStorageLifecycle,
  discardConsoleStorage,
  openConsoleStorage,
} from '@mechane/console-cache';
import type { ConsoleStorageHealth } from '@mechane/console-cache';
import type { Workspace } from '@mechane/protocol';
import { PrincipalId, WorkspaceId } from '@mechane/records';
import { DbClient } from '@tanstack/db';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import type { QueryFunctionContext, QueryKey } from '@tanstack/query-core';
import { Duration, MutableRef, Result, Schema } from 'effect';
import { createApi, readFailureScope } from './api.ts';
import {
  createCanonicalCollections,
  createCanonicalWriter,
  deleteRows,
  materializeCanonicalCollections,
  upsertRows,
} from './collections.ts';
import { createCommands } from './commands.ts';
import { createConversationApi } from './conversation.ts';
import { applyRead, fetchRead, saveMech } from './load-read.ts';
import { createReadDiagnostics } from './read-diagnostics.ts';
import { waitForRead } from './read-ready.ts';
import { recordKey } from './records.ts';
import { decodeReadRequest, isArtifactRead, readRequests } from './requests.ts';
import type { ReadKind, ReadReceipt, ReadRequest } from './requests.ts';
import {
  INVALIDATION_CHANNEL,
  INVALIDATION_KIND,
  publishScopeInvalidation,
  ScopeInvalidation,
} from './scope-invalidation.ts';
import type { InvalidationTarget } from './scope-invalidation.ts';
import type { Session } from './session.ts';

const REFRESH_MS = Duration.toMillis('15 seconds');
const CACHE_MS = Duration.toMillis('1 minute');
const ACTIVITY_REFRESH_MS = Duration.toMillis('5 seconds');
const ALLOWANCE_REFRESH_MS = Duration.toMillis('30 seconds');
// One preceding read can include its HTTP budget and two prepare/accept cache phases.
const READ_ADMISSION_PHASES = 5;
const READ_ADMISSION_TIMEOUT_MS = CONSOLE_STORAGE_OPERATION_TIMEOUT_MS * READ_ADMISSION_PHASES;
const CLEAR_SCOPE_TIMEOUT_MS = Duration.toMillis('3 seconds');

const ACTIVITY_READ_KINDS: ReadonlyArray<ReadKind> = ['events', 'turns', 'mech', 'turnEvents', 'trace'];

class UnsupportedReadDemand extends Schema.TaggedError<UnsupportedReadDemand>()('UnsupportedReadDemand', {}) {}
class ScopeAdmissionEnded extends Schema.TaggedError<ScopeAdmissionEnded>()('ScopeAdmissionEnded', {}) {}
class ReadAdmissionEnded extends Schema.TaggedError<ReadAdmissionEnded>()('ReadAdmissionEnded', {}) {}

type ReadObservation = { readonly subscribe: (listener: () => void) => () => void; readonly unsubscribe: () => void };

type ReadFailure = {
  readonly request: ReadRequest;
  readonly error: unknown;
  readonly signal: AbortSignal;
  /** Absent when the server failure determines its removal scope. */
  readonly failureScope?: ReturnType<typeof readFailureScope>;
  /** Absent when the originating failure should notify peer runtimes. */
  readonly shouldBroadcast?: boolean;
};

type ConsoleDataHealth = ConsoleStorageHealth & {
  readonly isDisposed: boolean;
  readonly isRevoked: boolean;
  /** Absent until this runtime observes a failure in local data handling. */
  readonly error?: unknown;
  readonly cleanupError?: unknown;
};

type CreateConsoleData = {
  readonly owner: ConsoleDataOwner;
  readonly origin: URL;
  readonly principalId: Session['principal']['id'];
  readonly workspace: Workspace;
  readonly signal: AbortSignal;
  readonly initialRequests: ReadonlyArray<ReadRequest>;
  readonly onSessionEnded: () => void;
};

/** Owns unfinished native cleanup across workspace replacement and sign-in changes. */
export function createConsoleDataOwner() {
  const lifecycle = createConsoleStorageLifecycle();

  return {
    async openStorage(input: Omit<Parameters<typeof openConsoleStorage>[0], 'lifecycle'>) {
      return await openConsoleStorage({ ...input, lifecycle });
    },
    trackCleanup: lifecycle.trackCleanup,
  };
}

export type ConsoleDataOwner = ReturnType<typeof createConsoleDataOwner>;

function readQueryKey(scope: string, request: ReadRequest): QueryKey {
  const owner = 'mechId' in request ? request.mechId : 'workspace';

  return [scope, 'read', request.kind, owner, request.id];
}

function readInterval(request: ReadRequest): number | false {
  switch (request.kind) {
    case 'mechs':
      return false;
    case 'events':
      return request.before === null ? ACTIVITY_REFRESH_MS : false;
    case 'turnEvents':
      return ACTIVITY_REFRESH_MS;
    case 'allowance':
      return ALLOWANCE_REFRESH_MS;
    case 'mech':
    case 'turns':
    case 'trace':
    case 'evidence':
    case 'evidenceArtifact':
    case 'environmentProcesses':
    case 'environmentProcess':
      return REFRESH_MS;
  }
}

type WorkspaceOwner = {
  readonly channel: BroadcastChannel;
  readonly api: ReturnType<typeof createConversationApi>;
  readonly revoke: () => void;
  readonly bindAccessLoss: (listener: () => void) => void;
  readonly subscribeInvalidation: (listener: (event: MessageEvent<unknown>) => void) => () => void;
  readonly recover: (close: () => Promise<void>, requests: ReadonlyArray<ReadRequest>) => Promise<ConsoleData>;
};

function createWorkspaceOwner(options: CreateConsoleData): WorkspaceOwner {
  const lifetime = new AbortController();
  const signal = AbortSignal.any([options.signal, lifetime.signal]);

  signal.throwIfAborted();

  const accessLost = MutableRef.make(options.onSessionEnded);
  const invalidations = new Set<(event: MessageEvent<unknown>) => void>();
  const broadcast = Result.try(() => new BroadcastChannel(INVALIDATION_CHANNEL));

  if (Result.isFailure(broadcast)) {
    throw new ConsoleStorageFailed({
      stage: ConsoleStorageStage.Admission,
      reason: `Admission notifications are unavailable: ${String(broadcast.failure)}`,
    });
  }

  const channel = broadcast.success;

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    // Admission revocation can remove all listeners during delivery.
    const recipients = [...invalidations];

    for (const listener of recipients) {
      listener(event);
    }
  });
  signal.addEventListener(
    'abort',
    () => {
      channel.close();
      invalidations.clear();
    },
    { once: true },
  );

  const owner: WorkspaceOwner = {
    channel,
    api: createConversationApi({
      origin: options.origin,
      workspaceId: options.workspace.id,
      signal,
      onAccessLost: () => accessLost.current(),
    }),
    revoke: () => lifetime.abort(),
    bindAccessLoss: (listener: () => void) => {
      accessLost.current = listener;
    },
    subscribeInvalidation: (listener: (event: MessageEvent<unknown>) => void) => {
      invalidations.add(listener);

      return () => invalidations.delete(listener);
    },
    async recover(close: () => Promise<void>, requests: ReadonlyArray<ReadRequest>): Promise<ConsoleData> {
      await close();

      return await openData({ ...options, initialRequests: requests }, owner);
    },
  };

  return owner;
}

/** Confirms current server admission before exposing local records for one cancelable scope. */
export async function createConsoleData(options: CreateConsoleData): Promise<ConsoleData> {
  const owner = createWorkspaceOwner(options);

  try {
    return await openData(options, owner);
  } catch (error) {
    owner.revoke();

    throw error;
  }
}

async function openData(options: CreateConsoleData, conversations: WorkspaceOwner): Promise<ConsoleData> {
  const { disposeForRecovery, ...runtime } = await createData(options, conversations);

  return {
    ...runtime,
    async recover(requests: ReadonlyArray<ReadRequest>): Promise<ConsoleData> {
      return await conversations.recover(disposeForRecovery, requests);
    },
  };
}

function createOwnerSignals() {
  const controllers = new Map<string, AbortController>();

  return {
    signal(key: string): AbortSignal {
      const existing = controllers.get(key);

      if (existing !== undefined) {
        return existing.signal;
      }

      const controller = new AbortController();

      controllers.set(key, controller);

      return controller.signal;
    },
    abort(key: string): void {
      const controller = controllers.get(key) ?? new AbortController();

      controllers.set(key, controller);
      controller.abort();
    },
    renew(key: string): void {
      if (controllers.get(key)?.signal.aborted === true) {
        controllers.set(key, new AbortController());
      }
    },
  };
}

async function createData(options: CreateConsoleData, conversations: WorkspaceOwner) {
  const { origin, principalId, workspace, onSessionEnded } = options;
  const scope = JSON.stringify([origin.origin, principalId, workspace.id]);

  const storageScope = {
    origin: origin.origin,
    principalId: PrincipalId.make(principalId),
    workspaceId: WorkspaceId.make(workspace.id),
  };

  const lifetime = new AbortController();
  const signal = AbortSignal.any([lifetime.signal, conversations.api.signal]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: REFRESH_MS, gcTime: CACHE_MS } },
  });

  const listeners = new Set<() => void>();
  const readListeners = new Set<() => void>();
  const readObservers = new Map<string, ReadObservation>();
  const revokedMechs = new Map<string, unknown>();
  const revokedTurns = new Map<string, unknown>();
  const revokedReads = MutableRef.make(new Map<string, unknown>());
  const mechLifetimes = createOwnerSignals();
  const turnLifetimes = createOwnerSignals();
  const readLifetimes = createOwnerSignals();
  const pendingWrites = new Set<Promise<unknown>>();
  const pendingRevocations = MutableRef.make(new Map<string, Promise<void>>());
  const channel = conversations.channel;
  const cleanup = MutableRef.make<Promise<void> | undefined>(undefined);

  const state = MutableRef.make<{
    readonly health: ConsoleDataHealth;
    readonly localIssue: ConsoleStorageHealth['issue'];
    readonly localFailure: unknown;
    readonly cleanupFailure: unknown;
    readonly isClearing: boolean;
    readonly revocation: unknown;
    readonly cacheInvalidation: unknown;
  }>({
    health: { isDisposed: false, isRevoked: false },
    localIssue: undefined,
    localFailure: undefined,
    cleanupFailure: undefined,
    isClearing: false,
    revocation: undefined,
    cacheInvalidation: undefined,
  });

  queryClient.mount();

  function notifyReads(): void {
    for (const listener of readListeners) {
      listener();
    }
  }

  function publishHealth(storage: ConsoleStorageHealth): void {
    const next = {
      isDisposed: state.current.health.isDisposed,
      isRevoked: state.current.health.isRevoked,
      error: state.current.localFailure,
      cleanupError: state.current.cleanupFailure,
    };

    const issue = state.current.localIssue ?? storage.issue;

    state.current = { ...state.current, health: issue === undefined ? next : { ...next, issue } };

    for (const listener of listeners) {
      listener();
    }
  }

  function reportLocalFailure(error: unknown): void {
    if (state.current.localIssue !== undefined || state.current.health.isDisposed) {
      return;
    }

    const failure = Schema.is(ConsoleStorageFailed)(error)
      ? error
      : new ConsoleStorageFailed({ stage: ConsoleStorageStage.Execute, reason: String(error) });

    globalThis.reportError(new Error(`Console cache failed during ${failure.stage}`));

    state.current = {
      ...state.current,
      localFailure: failure,
      localIssue: {
        kind: 'failed',
        message: 'The local cache could not be updated. Reopen this workspace to continue',
      },
    };

    lifetime.abort(failure);
    notifyReads();
    publishHealth(state.current.health);
    void closeFailedCache();
  }

  async function closeFailedCache(): Promise<void> {
    try {
      const { cache } = await initialized;

      await cache.dispose();
    } catch (error) {
      recordCleanupFailure(error);
    }
  }

  function invalidateCache(failure: ConsoleStorageFailed): void {
    if (state.current.health.isDisposed) {
      recordCleanupFailure(failure);

      return;
    }

    if (state.current.cacheInvalidation !== undefined) {
      return;
    }

    state.current = { ...state.current, cacheInvalidation: failure };

    lifetime.abort(failure);
    reportLocalFailure(failure);
    notifyReads();
  }

  function broadcastInvalidation(target: InvalidationTarget): void {
    if (!conversations.api.signal.aborted) {
      const admittedPrincipalId = PrincipalId.make(principalId);

      publishScopeInvalidation({
        channel,
        invalidation: { origin: origin.origin, principalId: admittedPrincipalId, target },
      });
    }
  }

  function endSession(failure: unknown = new ScopeAdmissionEnded({}), shouldBroadcast = true): void {
    if (!state.current.health.isRevoked && shouldBroadcast) {
      broadcastInvalidation({ kind: INVALIDATION_KIND.Session });
    }

    state.current = { ...state.current, revocation: failure, health: { ...state.current.health, isRevoked: true } };

    lifetime.abort();
    conversations.revoke();
    notifyReads();
    void retireScopeCache();
    onSessionEnded();
  }

  async function retireScopeCache(): Promise<void> {
    const discarded = await discardConsoleStorage({
      origin: origin.origin,
      principalId: PrincipalId.make(principalId),
      workspaceId: WorkspaceId.make(workspace.id),
    });

    if (!discarded) {
      recordCleanupFailure(
        new ConsoleStorageFailed({
          stage: ConsoleStorageStage.Retire,
          reason: 'Revoked workspace data could not be retired',
        }),
      );
    }
  }

  conversations.bindAccessLoss(endSession);

  function signalForRead(request: ReadRequest): AbortSignal {
    const signals = [signal, readLifetimes.signal(request.id)];

    if ('mechId' in request) {
      signals.push(mechLifetimes.signal(request.mechId));

      if ('turnId' in request) {
        signals.push(turnLifetimes.signal(recordKey(request.mechId, request.turnId)));
      }
    }

    return AbortSignal.any(signals);
  }

  async function trackWrite<Value>(writing: Promise<Value>, writeSignal = signal): Promise<Value> {
    pendingWrites.add(writing);

    try {
      return await writing;
    } catch (error) {
      if (!writeSignal.aborted) {
        reportLocalFailure(error);
      }

      throw error;
    } finally {
      pendingWrites.delete(writing);
    }
  }

  const api = createApi(origin, signal, endSession);

  async function loadReceipt(context: QueryFunctionContext) {
    const id = context.queryKey[4];

    if (typeof id !== 'string') {
      throw new UnsupportedReadDemand({});
    }

    const request = decodeReadRequest(id);
    const requestSignal = AbortSignal.any([signalForRead(request), context.signal]);

    const { cache, writeRows, tables } = await initialized;
    const lock = JSON.stringify(['mechane-console-read', cache.generationId, request.id]);
    const admission = AbortSignal.any([requestSignal, AbortSignal.timeout(READ_ADMISSION_TIMEOUT_MS)]);

    return await navigator.locks.request(lock, { signal: admission }, async () => {
      try {
        requestSignal.throwIfAborted();

        const answer = await fetchRead({ api, workspaceId: workspace.id, request, signal: requestSignal });

        requestSignal.throwIfAborted();

        if ('mechId' in request) {
          revokedMechs.delete(request.mechId);

          if ('turnId' in request) {
            revokedTurns.delete(recordKey(request.mechId, request.turnId));
          }
        }

        revokedReads.current.delete(request.id);

        const receipt: ReadReceipt = await trackWrite(
          applyRead({
            writeRows,
            tables,
            answer,
            signal: requestSignal,
            isMechAllowed: (mechId) => !revokedMechs.has(mechId),
            isTurnAllowed: (key) => !revokedTurns.has(key),
          }),
          requestSignal,
        );

        await trackWrite(
          writeRows({
            signal: requestSignal,
            collections: [tables.reads],
            write: () => upsertRows(tables.reads, [receipt]),
          }),
          requestSignal,
        );

        notifyReads();

        if (request.kind === 'mechs') {
          for (const key of receipt.keys) {
            const summary = tables.mechs.get(key);
            const definition = tables.mechDefinitions.get(key);

            if (
              summary !== undefined &&
              definition !== undefined &&
              summary.value.revision > definition.value.revision
            ) {
              void Promise.allSettled([refreshActive(readRequests.mech(key))]);
            }
          }
        }

        return Date.now();
      } catch (error) {
        await handleFailure({ request, error, signal: requestSignal });

        throw error;
      }
    });
  }

  async function handleFailure({
    request,
    error,
    signal: failureSignal,
    failureScope = readFailureScope(error),
    shouldBroadcast = true,
  }: ReadFailure): Promise<void> {
    if (!failureSignal.aborted || !shouldBroadcast) {
      switch (failureScope) {
        case 'scope':
          endSession(error);

          break;
        case 'mech':
          if ('mechId' in request) {
            revokedMechs.set(request.mechId, error);
            mechLifetimes.abort(request.mechId);
            notifyReads();

            if (shouldBroadcast) {
              broadcastInvalidation({
                kind: INVALIDATION_KIND.Mech,
                workspaceId: WorkspaceId.make(workspace.id),
                mechId: request.mechId,
              });
            }

            const revocation = revokeMech(request.mechId);

            pendingRevocations.current.set(request.mechId, revocation);
            await revocation;
          }

          break;
        case 'turn':
          if ('turnId' in request) {
            const key = recordKey(request.mechId, request.turnId);

            revokedTurns.set(key, error);
            turnLifetimes.abort(key);
            notifyReads();

            if (shouldBroadcast) {
              broadcastInvalidation({
                kind: INVALIDATION_KIND.Turn,
                workspaceId: WorkspaceId.make(workspace.id),
                mechId: request.mechId,
                turnId: request.turnId,
              });
            }

            const revocation = revokeTurn(request);

            pendingRevocations.current.set(key, revocation);
            await revocation;
          }

          break;
        case 'artifact':
          if (request.kind === 'evidenceArtifact') {
            await invalidateArtifact({ request, error, shouldBroadcast });
          }

          break;
        case undefined:
          break;
        case 'request':
          revokedReads.current.set(request.id, error);
          readLifetimes.abort(request.id);
          notifyReads();

          if (shouldBroadcast) {
            broadcastInvalidation({
              kind: INVALIDATION_KIND.Read,
              workspaceId: WorkspaceId.make(workspace.id),
              readId: request.id,
            });
          }

          try {
            await deleteReceipts([request.id]);
          } catch (localFailure) {
            await discardFailedPurge(localFailure);
          }

          break;
      }
    }
  }

  async function initialize() {
    const [currentPrincipal, currentWorkspaces] = await Promise.all([
      api('showPrincipal', {}),
      api('listWorkspaces', {}),
    ]);

    signal.throwIfAborted();

    const hasPrincipal = currentPrincipal.principal.id === principalId;
    const hasWorkspace = currentWorkspaces.workspaces.some((candidate) => candidate.id === workspace.id);

    if (!hasPrincipal || !hasWorkspace) {
      const failure = new ScopeAdmissionEnded({});

      endSession(failure);

      throw failure;
    }

    const db = new DbClient();

    const storage = await options.owner.openStorage({ ...storageScope, signal, onInvalidated: invalidateCache });

    async function closeInitialization(): Promise<void> {
      try {
        await db.cleanup();
      } catch (cleanupError) {
        recordCleanupFailure(cleanupError);
      } finally {
        try {
          if (state.current.health.isRevoked || state.current.isClearing) {
            await storage.discard();
          }
        } finally {
          await storage.dispose();
        }
      }
    }

    try {
      signal.throwIfAborted();
      publishHealth(storage.readHealth());

      const canonical = createCanonicalCollections(scope, storage.persistence);
      const tables = materializeCanonicalCollections(db, canonical);

      const receipts = tables.reads;

      const writeRows = createCanonicalWriter({
        db,
        generationId: storage.generationId,
        retire: async (error) => {
          state.current = { ...state.current, isClearing: true };

          reportLocalFailure(error);
          invalidateCache(
            new ConsoleStorageFailed({ stage: ConsoleStorageStage.CanonicalCommit, reason: String(error) }),
          );
          await storage.discard();
        },
      });

      const unsubscribeStorage = storage.subscribeHealth(() => publishHealth(storage.readHealth()));

      const unsubscribeTables = Object.values(tables).map((table) =>
        table.on('health:change', () => {
          if (table.health.hasErrors) {
            reportLocalFailure(table.health.error ?? table.health.failureReason);
          }
        }),
      );

      return {
        db,
        writeRows,
        tables,
        collections: canonical,
        receipts,
        cache: storage,
        unsubscribeStorage,
        unsubscribeTables,
      };
    } catch (error) {
      const closing = options.owner.trackCleanup(storageScope, closeInitialization());

      try {
        await awaitCleanup(closing, storage.dispose);
      } catch (cleanupError) {
        recordCleanupFailure(cleanupError);
      }

      throw error;
    }
  }

  async function startRuntime() {
    try {
      return await initialize();
    } catch (error) {
      if (!signal.aborted && readFailureScope(error) === 'scope') {
        endSession(error);
      }

      lifetime.abort();
      queryClient.unmount();
      await queryClient.cancelQueries();
      queryClient.clear();
      unsubscribeInvalidation();

      if (state.current.health.isRevoked) {
        const discarded = await discardConsoleStorage({
          origin: origin.origin,
          principalId: PrincipalId.make(principalId),
          workspaceId: WorkspaceId.make(workspace.id),
        });

        if (!discarded) {
          reportLocalFailure(error);
        }
      }

      throw error;
    }
  }

  const initialized = startRuntime();

  const unsubscribeInvalidation = conversations.subscribeInvalidation(receiveInvalidation);

  for (const request of options.initialRequests) {
    void Promise.allSettled([queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt })]);
  }

  const runtime = await initialized;

  async function deleteReceipts(keys: ReadonlyArray<string>): Promise<void> {
    const { writeRows, receipts } = await initialized;

    await writeRows({ signal, collections: [receipts], write: () => deleteRows(receipts, keys) });
  }

  async function invalidateArtifact({
    request,
    error,
    shouldBroadcast,
  }: {
    readonly error: unknown;
    readonly request: ReadRequest<'evidenceArtifact'>;
    readonly shouldBroadcast: boolean;
  }): Promise<void> {
    const { receipts } = await initialized;

    const queryIds = queryClient
      .getQueryCache()
      .findAll()
      .flatMap((query) => (typeof query.queryKey[4] === 'string' ? [query.queryKey[4]] : []));

    const knownIds = new Set([request.id, ...queryIds, ...[...receipts.values()].map((receipt) => receipt.id)]);

    const affected = [...knownIds]
      .map((id) => decodeReadRequest(id))
      .filter((candidate) => isArtifactRead({ candidate, artifact: request }));

    revokedReads.current = new Map([
      ...revokedReads.current,
      ...affected.map((candidate) => [candidate.id, error] as const),
    ]);

    for (const candidate of affected) {
      readLifetimes.abort(candidate.id);
    }

    notifyReads();

    if (shouldBroadcast) {
      broadcastInvalidation({
        kind: INVALIDATION_KIND.Artifact,
        workspaceId: WorkspaceId.make(workspace.id),
        mechId: request.mechId,
        artifactId: request.artifactId,
      });
    }

    const revocation = revokeArtifact(request);

    pendingRevocations.current = new Map([
      ...pendingRevocations.current,
      ...affected.map((candidate) => [candidate.id, revocation] as const),
    ]);

    await revocation;
  }

  async function revokeArtifact(request: ReadRequest<'evidenceArtifact'>): Promise<void> {
    try {
      await Promise.allSettled(pendingWrites);

      const { writeRows, tables, receipts } = await initialized;
      const key = recordKey(request.mechId, request.artifactId);

      await writeRows({
        signal,
        collections: [tables.evidenceArtifacts, receipts],
        write: () => {
          deleteRows(tables.evidenceArtifacts, [key]);

          const keys = [...receipts.values()]
            .filter((receipt) => isArtifactRead({ candidate: decodeReadRequest(receipt.id), artifact: request }))
            .map((receipt) => receipt.id);

          deleteRows(receipts, keys);
        },
      });
    } catch (error) {
      await discardFailedPurge(error);
    }
  }

  async function revokeMech(mechId: string): Promise<void> {
    try {
      await Promise.allSettled(pendingWrites);

      const { writeRows, tables, receipts } = await initialized;

      const scoped = [
        tables.turns,
        tables.events,
        tables.traceEvidence,
        tables.evidenceArtifacts,
        tables.environmentProcesses,
        tables.environmentProcessDetails,
      ];

      await writeRows({
        signal,
        collections: [tables.mechs, tables.mechDefinitions, receipts, ...scoped],
        write: () => {
          if (tables.mechs.has(mechId)) {
            deleteRows(tables.mechs, [mechId]);
          }

          if (tables.mechDefinitions.has(mechId)) {
            deleteRows(tables.mechDefinitions, [mechId]);
          }

          for (const table of scoped) {
            const keys = [...table.values()].filter((row) => row.mechId === mechId).map((row) => row.key);

            deleteRows(table, keys);
          }

          const keys = [...receipts.values()]
            .filter((receipt) => {
              const request = decodeReadRequest(receipt.id);

              return 'mechId' in request && request.mechId === mechId;
            })
            .map((receipt) => receipt.id);

          deleteRows(receipts, keys);
        },
      });
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: [scope, 'read', 'mechs'], refetchType: 'active' }),
      ]);
    } catch (error) {
      await discardFailedPurge(error);
    }
  }

  async function revokeTurn(request: ReadRequest<'trace' | 'turnEvents' | 'evidence'>): Promise<void> {
    try {
      await Promise.allSettled(pendingWrites);

      const { writeRows, tables, receipts } = await initialized;
      const key = recordKey(request.mechId, request.turnId);

      await writeRows({
        signal,
        collections: [tables.turns, tables.traceEvidence, receipts],
        write: () => {
          if (tables.turns.has(key)) {
            deleteRows(tables.turns, [key]);
          }

          if (tables.traceEvidence.has(key)) {
            deleteRows(tables.traceEvidence, [key]);
          }

          const keys = [...receipts.values()]
            .filter((receipt) => {
              const read = decodeReadRequest(receipt.id);

              return 'turnId' in read && read.mechId === request.mechId && read.turnId === request.turnId;
            })
            .map((receipt) => receipt.id);

          deleteRows(receipts, keys);
        },
      });
    } catch (error) {
      await discardFailedPurge(error);
    }
  }

  async function discardFailedPurge(error: unknown): Promise<void> {
    state.current = { ...state.current, isClearing: true };

    reportLocalFailure(error);
    invalidateCache(new ConsoleStorageFailed({ stage: ConsoleStorageStage.Retire, reason: String(error) }));

    const { cache } = await initialized;

    try {
      await cache.discard();
    } catch (failure) {
      recordCleanupFailure(failure);
    }
  }

  async function refreshActive(request: ReadRequest): Promise<void> {
    if (!signal.aborted) {
      await queryClient.invalidateQueries({
        queryKey: readQueryKey(scope, request),
        exact: true,
        refetchType: 'active',
      });
    }
  }

  async function refreshKind(kind: ReadKind, mechId?: string): Promise<void> {
    if (!signal.aborted) {
      const queryKey: QueryKey = mechId === undefined ? [scope, 'read', kind] : [scope, 'read', kind, mechId];

      await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
    }
  }

  async function refreshActivity(mechId: string): Promise<void> {
    await Promise.allSettled([
      ...ACTIVITY_READ_KINDS.map((kind) => refreshKind(kind, mechId)),
      refreshKind('allowance'),
    ]);
  }

  function observeRead(request: ReadRequest): ReadObservation {
    const subscribers = new Set<() => void>();

    const observer = new QueryObserver(queryClient, {
      queryKey: readQueryKey(scope, request),
      queryFn: loadReceipt,
      enabled: () => !signalForRead(request).aborted,
      refetchOnWindowFocus: true,
      refetchInterval: readInterval(request),
    });

    const unsubscribe = observer.subscribe(() => {
      for (const subscriber of subscribers) {
        subscriber();
      }
    });

    const observation: ReadObservation = {
      subscribe(listener) {
        subscribers.add(listener);
        readListeners.add(listener);

        return () => {
          subscribers.delete(listener);
          readListeners.delete(listener);

          if (subscribers.size === 0) {
            unsubscribe();
            readObservers.delete(request.id);
          }
        };
      },
      unsubscribe,
    };

    readObservers.set(request.id, observation);

    return observation;
  }

  async function closeRuntime(): Promise<void> {
    state.current = { ...state.current, health: { ...state.current.health, isDisposed: true } };

    lifetime.abort();
    queryClient.unmount();
    runtime.unsubscribeStorage();

    for (const observation of readObservers.values()) {
      observation.unsubscribe();
    }

    readObservers.clear();

    for (const unsubscribe of runtime.unsubscribeTables) {
      unsubscribe();
    }

    async function closeCollections(): Promise<void> {
      await queryClient.cancelQueries();
      await Promise.allSettled([...pendingWrites, ...pendingRevocations.current.values()]);
      await runtime.db.cleanup();
    }

    try {
      await closeCollections();
    } catch (error) {
      recordCleanupFailure(error);
    } finally {
      queryClient.clear();

      try {
        if (state.current.health.isRevoked || state.current.isClearing) {
          await runtime.cache.discard();
        }
      } finally {
        await runtime.cache.dispose();
      }
    }
  }

  function recordCleanupFailure(error: unknown): void {
    if (state.current.cleanupFailure !== undefined) {
      return;
    }

    const failure = Schema.is(ConsoleStorageFailed)(error)
      ? error
      : new ConsoleStorageFailed({ stage: ConsoleStorageStage.Close, reason: String(error) });

    globalThis.reportError(new Error(`Console cache failed during ${failure.stage}`));

    state.current = {
      ...state.current,
      cleanupFailure: failure,
      localFailure: state.current.localFailure ?? failure,
      localIssue: state.current.localIssue ?? {
        kind: 'failed',
        message: 'The local cache could not be closed cleanly',
      },
    };

    publishHealth(state.current.health);
  }

  async function awaitCleanup(operation: Promise<void>, close: () => Promise<void>): Promise<void> {
    const expired = Promise.withResolvers<never>();

    async function closeAfterDeadline(): Promise<void> {
      try {
        await close();
      } catch (error) {
        recordCleanupFailure(error);
      }
    }

    const deadline = setTimeout(() => {
      const failure = new ConsoleStorageFailed({
        stage: ConsoleStorageStage.Close,
        reason: 'The previous workspace is still closing. Try again after it closes',
      });

      void closeAfterDeadline();
      expired.reject(failure);
    }, CONSOLE_STORAGE_OPERATION_TIMEOUT_MS);

    try {
      return await Promise.race([operation, expired.promise]);
    } finally {
      clearTimeout(deadline);
    }
  }

  async function waitForCleanup(): Promise<void> {
    cleanup.current ??= options.owner.trackCleanup(storageScope, closeRuntime());

    await awaitCleanup(cleanup.current, runtime.cache.dispose);
  }

  async function dispose(): Promise<void> {
    unsubscribeInvalidation();

    try {
      await waitForCleanup();
    } catch (error) {
      recordCleanupFailure(error);
    }
  }

  async function disposeForRecovery(): Promise<void> {
    await waitForCleanup();
  }

  async function clearScope(): Promise<void> {
    state.current = {
      ...state.current,
      isClearing: true,
      revocation: new ScopeAdmissionEnded({}),
      health: { ...state.current.health, isRevoked: true },
    };

    broadcastInvalidation({ kind: INVALIDATION_KIND.Session });
    conversations.revoke();
    notifyReads();
    void retireScopeCache();

    const forced = Promise.withResolvers<void>();

    async function forceDiscard(): Promise<void> {
      try {
        await runtime.cache.discard();
      } catch (error) {
        reportLocalFailure(error);
      } finally {
        forced.resolve();
      }
    }

    const deadline = setTimeout(() => {
      void forceDiscard();
    }, CLEAR_SCOPE_TIMEOUT_MS);

    try {
      await Promise.race([dispose(), forced.promise]);
    } finally {
      clearTimeout(deadline);
    }
  }

  function receiveInvalidation(event: MessageEvent<unknown>): void {
    const decoded = Schema.decodeUnknownResult(ScopeInvalidation)(event.data);

    if (Result.isFailure(decoded) || decoded.success.origin !== origin.origin) {
      return;
    }

    if ('principalId' in decoded.success && decoded.success.principalId !== principalId) {
      return;
    }

    const { target } = decoded.success;

    if (target.kind === INVALIDATION_KIND.Session) {
      state.current = { ...state.current, isClearing: true };

      endSession(new ScopeAdmissionEnded({}), false);
      void Promise.allSettled([initialized.then(dispose)]);

      return;
    }

    if (target.workspaceId !== workspace.id) {
      return;
    }

    const failure = new ReadAdmissionEnded({});

    switch (target.kind) {
      case 'mech':
        void Promise.allSettled([
          handleFailure({
            request: readRequests.mech(target.mechId),
            error: failure,
            signal,
            failureScope: 'mech',
            shouldBroadcast: false,
          }),
        ]);

        break;
      case 'turn':
        void Promise.allSettled([
          handleFailure({
            request: readRequests.trace(target.mechId, target.turnId),
            error: failure,
            signal,
            failureScope: 'turn',
            shouldBroadcast: false,
          }),
        ]);

        break;
      case 'artifact':
        void Promise.allSettled([
          handleFailure({
            request: readRequests.evidenceArtifact(target.mechId, target.artifactId),
            error: failure,
            signal,
            failureScope: 'artifact',
            shouldBroadcast: false,
          }),
        ]);

        break;
      case 'read': {
        const decodedRequest = Result.try(() => decodeReadRequest(target.readId));

        if (Result.isSuccess(decodedRequest)) {
          void Promise.allSettled([
            handleFailure({
              request: decodedRequest.success,
              error: failure,
              signal,
              failureScope: 'request',
              shouldBroadcast: false,
            }),
          ]);
        }

        break;
      }
    }
  }

  function readRevocation(request: ReadRequest): unknown {
    if (state.current.health.isRevoked) {
      return state.current.revocation;
    }

    if ('mechId' in request) {
      const mechFailure = revokedMechs.get(request.mechId);

      if (mechFailure !== undefined) {
        return mechFailure;
      }

      if ('turnId' in request) {
        const failure =
          revokedTurns.get(recordKey(request.mechId, request.turnId)) ?? revokedReads.current.get(request.id);

        if (failure !== undefined) {
          return failure;
        }
      }
    }

    const receipt = runtime.receipts.get(request.id);

    if (receipt === undefined) {
      // A cleaned owner cannot prove that a removed member was absent from its retained list.
      if (request.kind === 'mechs') {
        return revokedMechs.values().next().value ?? revokedReads.current.get(request.id);
      }

      if (request.kind === 'turns') {
        return revokedTurns.values().next().value ?? revokedReads.current.get(request.id);
      }

      if (request.kind === 'evidence') {
        for (const [id, error] of revokedReads.current) {
          const revoked = decodeReadRequest(id);

          if (revoked.kind === 'evidenceArtifact' && revoked.mechId === request.mechId) {
            return error;
          }
        }
      }
    }

    if (receipt !== undefined && request.kind === 'mechs') {
      const key = receipt.keys.find((value) => revokedMechs.has(value));

      if (key !== undefined) {
        return revokedMechs.get(key);
      }
    }

    if (receipt !== undefined && request.kind === 'turns') {
      const key = receipt.keys.find((value) => revokedTurns.has(value));

      if (key !== undefined) {
        return revokedTurns.get(key);
      }
    }

    return revokedReads.current.get(request.id);
  }

  return {
    scope,
    db: runtime.db,
    collections: runtime.collections,
    workspace,
    diagnostics: createReadDiagnostics(queryClient),
    conversations: conversations.api,
    reads: readRequests,
    refreshActivity,
    commands: createCommands({
      api,
      workspaceId: workspace.id,
      signal,
      saveMech: async (mech, writeSignal) =>
        await trackWrite(
          saveMech({ writeRows: runtime.writeRows, tables: runtime.tables, mech, signal: writeSignal }),
          writeSignal,
        ),
      signalForRead,
      onFailure: async (request, error, failureSignal) =>
        await handleFailure({ request, error, signal: failureSignal }),
      reportLocalFailure,
      refreshActivity,
      refreshRequest: refreshActive,
      refreshKind,
    }),
    readStatus(request: ReadRequest) {
      return queryClient.getQueryState<number>(readQueryKey(scope, request));
    },
    readRevocation,
    isReadRevoked: (request: ReadRequest) => readRevocation(request) !== undefined,
    subscribeReadStatus(id: ReadRequest['id'], onChange: () => void): () => void {
      const request = decodeReadRequest(id);
      const observation = readObservers.get(request.id) ?? observeRead(request);

      return observation.subscribe(onChange);
    },
    readHealth(): ConsoleDataHealth {
      return state.current.health;
    },
    subscribeHealth(onChange: () => void): () => void {
      listeners.add(onChange);

      return () => {
        listeners.delete(onChange);
      };
    },
    async refresh(request: ReadRequest): Promise<void> {
      signal.throwIfAborted();
      await pendingRevocations.current.get(request.id);
      readLifetimes.renew(request.id);

      if ('mechId' in request) {
        await pendingRevocations.current.get(request.mechId);

        mechLifetimes.renew(request.mechId);

        if ('turnId' in request) {
          const key = recordKey(request.mechId, request.turnId);

          await pendingRevocations.current.get(key);

          turnLifetimes.renew(key);
        }
      }

      await queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt, staleTime: 0 });
    },
    async ready(request: ReadRequest, abort?: AbortSignal): Promise<void> {
      const resourceSignal = signalForRead(request);
      const demandSignal = abort === undefined ? resourceSignal : AbortSignal.any([resourceSignal, abort]);

      await waitForRead({
        receipts: runtime.receipts,
        tables: runtime.tables,
        request,
        signal: demandSignal,
        refreshRead: () =>
          queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt, staleTime: 0 }),
      });
    },
    clearScope,
    dispose,
    disposeForRecovery,
  };
}

/** Owns native collections, exact read demands, commands, and cleanup for one admitted workspace. */
export type ConsoleData = Omit<Awaited<ReturnType<typeof createData>>, 'disposeForRecovery'> & {
  readonly recover: (requests: ReadonlyArray<ReadRequest>) => Promise<ConsoleData>;
};
