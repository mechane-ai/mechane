import { createMemoryStorage, discardConsoleStorage, openConsoleStorage } from '@mechane/console-cache';
import type { ConsoleStorageHealth } from '@mechane/console-cache';
import type { Workspace } from '@mechane/protocol';
import { PrincipalId, WorkspaceId } from '@mechane/records';
import { collectionOptions, DbClient } from '@tanstack/db';
import type { LoadSubsetOptions } from '@tanstack/db';
import { persistedCollectionOptions } from '@tanstack/db-sqlite-persistence-core';
import { hashKey, QueryClient } from '@tanstack/query-core';
import type { QueryFunctionContext, QueryKey } from '@tanstack/query-core';
import { parseLoadSubsetOptions, queryCollectionOptions } from '@tanstack/query-db-collection';
import { Duration, MutableRef, Result, Schema } from 'effect';
import { createApi, readFailureScope } from './api.ts';
import {
  collectionId,
  commitRows,
  createCanonicalCollections,
  deleteRows,
  materializeCanonicalCollections,
} from './collections.ts';
import { createCommands } from './commands.ts';
import { applyRead, fetchRead, saveMech } from './load-read.ts';
import { waitForRead } from './read-ready.ts';
import { recordKey, restoreRecord } from './records.ts';
import { decodeReadRequest, ReadReceipt, readRequests } from './requests.ts';
import type { ReadRequest } from './requests.ts';
import type { Session } from './session.ts';

const REFRESH_MS = Duration.toMillis('15 seconds');
const CACHE_MS = Duration.toMillis('1 minute');
const ACTIVITY_REFRESH_MS = Duration.toMillis('5 seconds');
const ALLOWANCE_REFRESH_MS = Duration.toMillis('30 seconds');
const CLEAR_SCOPE_TIMEOUT_MS = Duration.toMillis('3 seconds');
const INVALIDATION_CHANNEL = 'mechane-console-admission';
const ScopeInvalidation = Schema.Struct({ origin: Schema.String, principalId: PrincipalId });

class UnsupportedReadDemand extends Schema.TaggedError<UnsupportedReadDemand>()('UnsupportedReadDemand', {}) {}
class ScopeAdmissionEnded extends Schema.TaggedError<ScopeAdmissionEnded>()('ScopeAdmissionEnded', {}) {}

type ConsoleDataHealth = ConsoleStorageHealth & {
  readonly isDisposed: boolean;
  readonly isRevoked: boolean;
  readonly hasScopeNotifications: boolean;
  /** Absent until this runtime observes a failure in local data handling. */
  readonly error?: unknown;
};

type CreateConsoleData = {
  readonly origin: URL;
  readonly principalId: Session['principal']['id'];
  readonly workspace: Workspace;
  readonly signal: AbortSignal;
  readonly initialRequests: ReadonlyArray<ReadRequest>;
  readonly onSessionEnded: () => void;
};

function demandRequest(options: LoadSubsetOptions): ReadRequest {
  const parsed = parseLoadSubsetOptions(options);
  const [filter] = parsed.filters;

  if (parsed.filters.length !== 1 || filter === undefined) {
    throw new UnsupportedReadDemand({});
  }

  const isIdentityFilter = filter.field.length === 1 && filter.field[0] === 'id' && filter.operator === 'eq';
  const isSingleReceipt = parsed.sorts.length === 0 && (parsed.limit === undefined || parsed.limit === 1);

  if (!isIdentityFilter || !isSingleReceipt || typeof filter.value !== 'string') {
    throw new UnsupportedReadDemand({});
  }

  return decodeReadRequest(filter.value);
}

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
    case 'threads':
    case 'memories':
    case 'turns':
    case 'trace':
    case 'slackBindings':
    case 'slackDeliveries':
      return REFRESH_MS;
  }
}

/** Confirms current server admission before exposing local records for one cancelable scope. */
export async function createConsoleData(options: CreateConsoleData): Promise<ConsoleData> {
  return await createRecoverableData(options, false);
}

async function createRecoverableData(options: CreateConsoleData, isMemoryOnly: boolean): Promise<ConsoleData> {
  const { disposeForRecovery, ...runtime } = await createData(options, isMemoryOnly);

  return {
    ...runtime,
    async continueOnline(requests: ReadonlyArray<ReadRequest>): Promise<ConsoleData> {
      return await recoverData(options, disposeForRecovery, requests);
    },
  };
}

async function recoverData(
  options: CreateConsoleData,
  disposeForRecovery: () => Promise<void>,
  requests: ReadonlyArray<ReadRequest>,
): Promise<ConsoleData> {
  await disposeForRecovery();

  return await createRecoverableData({ ...options, initialRequests: requests }, true);
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
      controllers.get(key)?.abort();
    },
    renew(key: string): void {
      if (controllers.get(key)?.signal.aborted === true) {
        controllers.set(key, new AbortController());
      }
    },
  };
}

async function createData(options: CreateConsoleData, isMemoryOnly: boolean) {
  const { origin, principalId, workspace, onSessionEnded } = options;
  const scope = JSON.stringify([origin.origin, principalId, workspace.id]);
  const lifetime = new AbortController();
  const signal = AbortSignal.any([lifetime.signal, options.signal]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: REFRESH_MS, gcTime: CACHE_MS } },
  });

  const listeners = new Set<() => void>();
  const readListeners = new Set<() => void>();
  const revokedMechs = new Map<string, unknown>();
  const revokedTurns = new Map<string, unknown>();
  const revokedReads = new Map<string, unknown>();
  const mechLifetimes = createOwnerSignals();
  const turnLifetimes = createOwnerSignals();
  const pendingWrites = new Set<Promise<unknown>>();
  const pendingRevocations = new Map<string, Promise<void>>();
  const broadcast = Result.try(() => new BroadcastChannel(INVALIDATION_CHANNEL));
  const channel = Result.isSuccess(broadcast) ? broadcast.success : undefined;
  const cleanup = MutableRef.make<Promise<void> | undefined>(undefined);

  const state = MutableRef.make<{
    readonly health: ConsoleDataHealth;
    readonly localIssue: ConsoleStorageHealth['issue'];
    readonly localFailure: unknown;
    readonly isClearing: boolean;
    readonly revocation: unknown;
  }>({
    health: { mode: 'memory', isDisposed: false, isRevoked: false, hasScopeNotifications: channel !== undefined },
    localIssue: undefined,
    localFailure: undefined,
    isClearing: false,
    revocation: undefined,
  });

  queryClient.mount();

  function notifyReads(): void {
    for (const listener of readListeners) {
      listener();
    }
  }

  function publishHealth(storage: ConsoleStorageHealth): void {
    const next = {
      mode: storage.mode,
      isDisposed: state.current.health.isDisposed,
      isRevoked: state.current.health.isRevoked,
      hasScopeNotifications: state.current.health.hasScopeNotifications,
      error: state.current.localFailure,
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

    state.current = {
      ...state.current,
      localFailure: error,
      localIssue: {
        kind: 'failed',
        message: 'The local cache could not be updated. Continue online to reload this workspace',
      },
    };

    publishHealth(state.current.health);
  }

  function broadcastInvalidation(): void {
    if (!state.current.health.isDisposed) {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no target origin
      channel?.postMessage({ origin: origin.origin, principalId });
    }
  }

  function endSession(failure: unknown = new ScopeAdmissionEnded({}), shouldBroadcast = true): void {
    if (!state.current.health.isRevoked && shouldBroadcast) {
      broadcastInvalidation();
    }

    state.current = { ...state.current, revocation: failure, health: { ...state.current.health, isRevoked: true } };

    lifetime.abort();
    notifyReads();
    onSessionEnded();
  }

  function signalForRead(request: ReadRequest): AbortSignal {
    const signals = [signal];

    if ('mechId' in request) {
      signals.push(mechLifetimes.signal(request.mechId));

      if ('turnId' in request) {
        signals.push(turnLifetimes.signal(recordKey(request.mechId, request.turnId)));
      }
    }

    return AbortSignal.any(signals);
  }

  async function trackWrite<Value>(writing: Promise<Value>): Promise<Value> {
    pendingWrites.add(writing);

    try {
      return await writing;
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

    try {
      requestSignal.throwIfAborted();

      const answer = await fetchRead({ api, workspaceId: workspace.id, request, signal: requestSignal });
      const { db, tables } = await initialized;

      requestSignal.throwIfAborted();

      if ('mechId' in request) {
        revokedMechs.delete(request.mechId);

        if ('turnId' in request) {
          revokedTurns.delete(recordKey(request.mechId, request.turnId));
        }
      }

      revokedReads.delete(request.id);

      const receipt: ReadReceipt = await trackWrite(
        applyRead({
          db,
          tables,
          answer,
          signal: requestSignal,
          isMechAllowed: (mechId) => !revokedMechs.has(mechId),
          isTurnAllowed: (key) => !revokedTurns.has(key),
        }),
      );

      notifyReads();

      if (request.kind === 'mechs') {
        for (const key of receipt.keys) {
          const summary = tables.mechs.get(key);
          const definition = tables.mechDefinitions.get(key);

          if (summary !== undefined && definition !== undefined && summary.value.revision > definition.value.revision) {
            void Promise.allSettled([refreshActive(readRequests.mech(key))]);
          }
        }
      }

      return [receipt];
    } catch (error) {
      await handleFailure(request, error, requestSignal);

      throw error;
    }
  }

  async function handleFailure(request: ReadRequest, error: unknown, failureSignal: AbortSignal): Promise<void> {
    if (!failureSignal.aborted) {
      switch (readFailureScope(error)) {
        case 'scope':
          endSession(error);

          break;
        case 'mech':
          if ('mechId' in request) {
            revokedMechs.set(request.mechId, error);
            mechLifetimes.abort(request.mechId);
            notifyReads();

            const revocation = revokeMech(request.mechId);

            pendingRevocations.set(request.mechId, revocation);
            await revocation;
          }

          break;
        case 'turn':
          if ('turnId' in request) {
            const key = recordKey(request.mechId, request.turnId);

            revokedTurns.set(key, error);
            turnLifetimes.abort(key);
            notifyReads();

            const revocation = revokeTurn(request);

            pendingRevocations.set(key, revocation);
            await revocation;
          }

          break;
        case undefined:
          break;
        case 'request':
          revokedReads.set(request.id, error);
          notifyReads();

          try {
            const { receipts } = await initialized;

            await receipts.utils.writeDelete(request.id);
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

    const storage = isMemoryOnly
      ? createMemoryStorage()
      : await openConsoleStorage({
          origin: origin.origin,
          principalId: PrincipalId.make(principalId),
          workspaceId: WorkspaceId.make(workspace.id),
          signal,
        });

    try {
      signal.throwIfAborted();
      publishHealth(storage.readHealth());

      const canonical = createCanonicalCollections(scope, storage.persistence);
      const tables = materializeCanonicalCollections(db, canonical);

      const reads = collectionOptions(collectionId(scope, 'reads'), () => {
        const base = queryCollectionOptions({
          id: collectionId(scope, 'reads'),
          schema: Schema.toStandardSchemaV1(ReadReceipt),
          getKey: (receipt: ReadReceipt): string => {
            const valid = restoreRecord(ReadReceipt, receipt);
            const request = decodeReadRequest(valid.id);

            if (request.kind !== valid.kind) {
              throw new UnsupportedReadDemand({});
            }

            return valid.id;
          },
          queryClient,
          queryKey: (subset: LoadSubsetOptions) =>
            subset.where === undefined ? [scope, 'read'] : readQueryKey(scope, demandRequest(subset)),
          queryFn: loadReceipt,
          syncMode: 'on-demand',
          retry: false,
          staleTime: REFRESH_MS,
          gcTime: CACHE_MS,
          persistedGcTime: Infinity,
          refetchOnWindowFocus: true,
          refetchInterval: (query) => {
            const id = query.queryKey[4];

            return typeof id === 'string' ? readInterval(decodeReadRequest(id)) : false;
          },
        });

        if (storage.persistence === undefined) {
          return base;
        }

        const persisted = persistedCollectionOptions({
          ...base,
          persistence: storage.persistence,
          initialRender: { strategy: 'network-first', networkTimeoutMs: 0 },
        });

        return { ...persisted, schema: base.schema, utils: base.utils };
      });

      const receipts = db.collection(reads);
      const unsubscribeStorage = storage.subscribeHealth(() => publishHealth(storage.readHealth()));

      const unsubscribeTables = Object.values(tables).map((table) =>
        table.on('health:change', () => {
          if (table.health.hasErrors) {
            reportLocalFailure(table.health.error ?? table.health.failureReason);
          }
        }),
      );

      const unsubscribeReceipts = receipts.on('health:change', () => {
        if (receipts.status === 'crashed') {
          reportLocalFailure(receipts.health.error);
        }
      });

      return {
        db,
        tables,
        collections: { ...canonical, reads },
        receipts,
        cache: storage,
        unsubscribeStorage,
        unsubscribeTables,
        unsubscribeReceipts,
      };
    } catch (error) {
      const cleanupResults = await Promise.allSettled([db.cleanup()]);

      for (const result of cleanupResults) {
        if (result.status === 'rejected') {
          reportLocalFailure(result.reason);
        }
      }

      if (state.current.health.isRevoked || state.current.isClearing || state.current.health.issue?.kind === 'failed') {
        await storage.discard();
      } else {
        await storage.dispose();
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
      channel?.close();
      queryClient.unmount();
      await queryClient.cancelQueries();
      queryClient.clear();

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

  for (const request of options.initialRequests) {
    void Promise.allSettled([queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt })]);
  }

  const runtime = await initialized;

  async function revokeMech(mechId: string): Promise<void> {
    try {
      await Promise.allSettled(pendingWrites);

      const { db, tables, receipts } = await initialized;

      const scoped = [
        tables.turns,
        tables.events,
        tables.threads,
        tables.memories,
        tables.traceEvidence,
        tables.slackBindings,
        tables.slackDeliveries,
      ];

      await commitRows({
        db,
        signal,
        collections: [tables.mechs, tables.mechDefinitions, ...scoped],
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
        },
      });

      const keys = [...receipts.values()]
        .filter((receipt) => {
          const request = decodeReadRequest(receipt.id);

          return 'mechId' in request && request.mechId === mechId;
        })
        .map((receipt) => receipt.id);

      await receipts.utils.writeDelete(keys);
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: [scope, 'read', 'mechs'], refetchType: 'active' }),
      ]);
    } catch (error) {
      await discardFailedPurge(error);
    }
  }

  async function revokeTurn(request: ReadRequest<'trace' | 'turnEvents'>): Promise<void> {
    try {
      await Promise.allSettled(pendingWrites);

      const { db, tables, receipts } = await initialized;
      const key = recordKey(request.mechId, request.turnId);

      await commitRows({
        db,
        signal,
        collections: [tables.turns, tables.traceEvidence],
        write: () => {
          if (tables.turns.has(key)) {
            deleteRows(tables.turns, [key]);
          }

          if (tables.traceEvidence.has(key)) {
            deleteRows(tables.traceEvidence, [key]);
          }
        },
      });

      const keys = [...receipts.values()]
        .filter((receipt) => {
          const read = decodeReadRequest(receipt.id);

          return 'turnId' in read && read.mechId === request.mechId && read.turnId === request.turnId;
        })
        .map((receipt) => receipt.id);

      await receipts.utils.writeDelete(keys);
    } catch (error) {
      await discardFailedPurge(error);
    }
  }

  async function discardFailedPurge(error: unknown): Promise<void> {
    state.current = { ...state.current, isClearing: true };

    reportLocalFailure(error);

    const { cache } = await initialized;

    await cache.discard();
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

  async function closeRuntime(): Promise<void> {
    state.current = { ...state.current, health: { ...state.current.health, isDisposed: true } };

    lifetime.abort();
    channel?.close();
    queryClient.unmount();
    runtime.unsubscribeStorage();
    runtime.unsubscribeReceipts();

    for (const unsubscribe of runtime.unsubscribeTables) {
      unsubscribe();
    }

    try {
      await queryClient.cancelQueries();
      await Promise.allSettled(pendingWrites);
      await runtime.db.cleanup();
    } catch {
      state.current = {
        ...state.current,
        localIssue: { kind: 'failed', message: 'The local cache could not be closed cleanly' },
      };

      publishHealth(state.current.health);
    } finally {
      queryClient.clear();

      if (state.current.health.isRevoked || state.current.isClearing || state.current.health.issue?.kind === 'failed') {
        await runtime.cache.discard();
      } else {
        await runtime.cache.dispose();
      }
    }
  }

  async function dispose(): Promise<void> {
    if (cleanup.current === undefined) {
      cleanup.current = closeRuntime();
    }

    await cleanup.current;
  }

  async function disposeForRecovery(): Promise<void> {
    state.current = { ...state.current, isClearing: true };

    await dispose();
  }

  async function clearScope(): Promise<void> {
    state.current = {
      ...state.current,
      isClearing: true,
      revocation: new ScopeAdmissionEnded({}),
      health: { ...state.current.health, isRevoked: true },
    };

    broadcastInvalidation();
    notifyReads();

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

  if (channel !== undefined) {
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      const decoded = Schema.decodeUnknownResult(ScopeInvalidation)(event.data);

      if (
        Result.isFailure(decoded) ||
        decoded.success.origin !== origin.origin ||
        decoded.success.principalId !== principalId
      ) {
        return;
      }

      state.current = { ...state.current, isClearing: true };

      endSession(new ScopeAdmissionEnded({}), false);
      void dispose();
    });
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
        return revokedTurns.get(recordKey(request.mechId, request.turnId)) ?? revokedReads.get(request.id);
      }
    }

    const receipt = runtime.receipts.get(request.id);

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

    return revokedReads.get(request.id);
  }

  return {
    scope,
    db: runtime.db,
    collections: runtime.collections,
    workspace,
    reads: readRequests,
    commands: createCommands({
      api,
      workspaceId: workspace.id,
      signal,
      saveMech: async (mech, writeSignal) =>
        await trackWrite(saveMech({ db: runtime.db, tables: runtime.tables, mech, signal: writeSignal })),
      signalForRead,
      onFailure: handleFailure,
      reportLocalFailure,
      refreshRequest: refreshActive,
      refreshKind: async (kind, mechId) => {
        if (!signal.aborted) {
          const queryKey: QueryKey = mechId === undefined ? [scope, 'read', kind] : [scope, 'read', kind, mechId];

          await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
        }
      },
    }),
    readStatus(request: ReadRequest) {
      return queryClient.getQueryState<Awaited<ReturnType<typeof loadReceipt>>>(readQueryKey(scope, request));
    },
    readRevocation,
    isReadRevoked: (request: ReadRequest) => readRevocation(request) !== undefined,
    subscribeReadStatus(request: ReadRequest, onChange: () => void): () => void {
      const queryHash = hashKey(readQueryKey(scope, request));

      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) {
          onChange();
        }
      });

      readListeners.add(onChange);

      return () => {
        unsubscribe();
        readListeners.delete(onChange);
      };
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

      if ('mechId' in request) {
        await pendingRevocations.get(request.mechId);

        mechLifetimes.renew(request.mechId);

        if ('turnId' in request) {
          const key = recordKey(request.mechId, request.turnId);

          await pendingRevocations.get(key);

          turnLifetimes.renew(key);
        }
      }

      await queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt, staleTime: 0 });
    },
    async ready(request: ReadRequest, abort?: AbortSignal): Promise<void> {
      const demandSignal = abort === undefined ? signal : AbortSignal.any([signal, abort]);

      await waitForRead({
        receipts: runtime.receipts,
        tables: runtime.tables,
        request,
        signal: demandSignal,
        refreshRead: () =>
          queryClient.query({ queryKey: readQueryKey(scope, request), queryFn: loadReceipt, staleTime: 0 }),
        reportLocalFailure,
      });
    },
    clearScope,
    dispose,
    disposeForRecovery,
  };
}

/** Owns native collections, exact read demands, commands, and cleanup for one admitted workspace. */
export type ConsoleData = Omit<Awaited<ReturnType<typeof createData>>, 'disposeForRecovery'> & {
  readonly continueOnline: (requests: ReadonlyArray<ReadRequest>) => Promise<ConsoleData>;
};
