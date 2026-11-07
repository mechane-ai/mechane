import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import type { PrincipalId, WorkspaceId } from '@mechane/records';
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
} from '@tanstack/browser-db-sqlite-persistence';
import type { BrowserWASQLiteDatabase, PersistedCollectionPersistence } from '@tanstack/browser-db-sqlite-persistence';
import { DateTime, Duration, Result, Schema } from 'effect';
import type { Types } from 'effect';
import { Base64Url, Hex } from 'effect/encoding';

const CACHE_NAMESPACE = 'mechane-console-opfs';
// The native VFS permits 64-character paths, including room for journal suffixes.
const CACHE_DIRECTORY = 'mc2';
const GENERATION_BYTES = 16;
const OPEN_TIMEOUT = Duration.seconds(5);
const OPERATION_TIMEOUT = Duration.seconds(10);
const CLEANUP_TIMEOUT = Duration.seconds(3);
const CACHE_MAX_AGE = Duration.hours(24);
const CACHE_PAGE_SIZE_BYTES = 4 * BYTES_PER_KIBIBYTE;
const CACHE_MAX_PAGES = 16_384;
const MISSING_FILE = 'NotFoundError';

const GenerationName = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{22}$/u));
const CacheGeneration = Schema.Struct({ generation: GenerationName, createdAt: Schema.DateTimeUtcFromMillis });
const CacheGenerationId = Schema.String.pipe(Schema.brand('ConsoleCacheGenerationId'));
type CacheGenerationId = typeof CacheGenerationId.Type;
type CacheGeneration = typeof CacheGeneration.Type;

/** Reports required persistence failures with a safe message and a separate diagnostic reason. */
export class ConsoleStorageFailed extends Schema.TaggedError<ConsoleStorageFailed>()('ConsoleStorageFailed', {
  reason: Schema.String,
}) {
  override readonly message = 'Persistent storage is unavailable. Allow site storage, then try again';
}

/** Persistence is required; an issue fences this owner until a fresh admitted runtime replaces it. */
export type ConsoleStorageHealth = {
  /** Absent while this storage owner is usable. */
  readonly issue?: { readonly kind: 'failed'; readonly message: string };
};

type ConsoleStorage = {
  readonly generationId: CacheGenerationId;
  readonly persistence: PersistedCollectionPersistence;
  readonly dispose: () => Promise<void>;
  readonly discard: () => Promise<void>;
  readonly readHealth: () => ConsoleStorageHealth;
  readonly subscribeHealth: (listener: () => void) => () => void;
};

type ConsoleStorageScope = {
  readonly origin: string;
  readonly principalId: PrincipalId;
  readonly workspaceId: WorkspaceId;
};

type OpenConsoleStorage = ConsoleStorageScope & { readonly signal: AbortSignal; readonly onInvalidated: () => void };

type CacheScope = { readonly name: string; readonly key: string };
type GenerationLease = { readonly release: () => Promise<void> };

type SelectedGeneration = {
  readonly scope: CacheScope;
  readonly generation: CacheGeneration;
  readonly wire: string;
  readonly lease: GenerationLease;
};

type Deadline<Value> = {
  readonly operation: Promise<Value>;
  readonly timeout: Duration.Duration;
  readonly message: string;
};

async function waitWithin<Value>({ operation, timeout, message }: Deadline<Value>): Promise<Value> {
  const expired = Promise.withResolvers<never>();

  const timer = setTimeout(
    () => expired.reject(new ConsoleStorageFailed({ reason: message })),
    Duration.toMillis(timeout),
  );

  try {
    return await Promise.race([operation, expired.promise]);
  } finally {
    clearTimeout(timer);
  }
}

async function createScope({ origin, principalId, workspaceId }: ConsoleStorageScope): Promise<CacheScope> {
  const encoded = new TextEncoder().encode(JSON.stringify([CACHE_NAMESPACE, origin, principalId, workspaceId]));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  const hash = Hex.encode(bytes);
  const name = Base64Url.encode(bytes.slice(0, GENERATION_BYTES));

  return { name, key: createScopeKey({ hash }) };
}

function createScopeKey({ hash }: { readonly hash: string }): string {
  return `${CACHE_NAMESPACE}:${hash}`;
}

function createDatabasePath({
  scope,
  generation,
}: {
  readonly scope: CacheScope;
  readonly generation: string;
}): string {
  return `${CACHE_DIRECTORY}/${scope.name}/${generation}/db`;
}

function readGeneration(scope: CacheScope): CacheGeneration | undefined {
  const wire = localStorage.getItem(scope.key);

  if (wire === null) {
    return undefined;
  }

  const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(CacheGeneration), { onExcessProperty: 'error' })(
    wire,
  );

  return Result.isSuccess(decoded) ? decoded.success : undefined;
}

function createGenerationKey({
  scope,
  generation,
}: {
  readonly scope: CacheScope;
  readonly generation: string;
}): string {
  return `${scope.key}:${generation}`;
}

async function acquireGeneration({
  scope,
  generation,
  signal,
}: {
  readonly scope: CacheScope;
  readonly generation: CacheGeneration;
  readonly signal: AbortSignal;
}): Promise<GenerationLease> {
  const acquired = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();

  const held = navigator.locks.request(
    createGenerationKey({ scope, generation: generation.generation }),
    { mode: 'shared', signal },
    async () => {
      acquired.resolve();
      await released.promise;
    },
  );

  void held.catch((error: unknown) => acquired.reject(error));
  await acquired.promise;

  return {
    async release() {
      released.resolve();
      await held;
    },
  };
}

async function selectGeneration({
  scope,
  signal,
}: {
  readonly scope: CacheScope;
  readonly signal: AbortSignal;
}): Promise<SelectedGeneration> {
  return await navigator.locks.request(scope.key, { signal }, async () => {
    const previous = readGeneration(scope);
    const now = DateTime.nowUnsafe();
    const maxAgeMs = Duration.toMillis(CACHE_MAX_AGE);

    const ageMs =
      previous === undefined ? maxAgeMs : DateTime.toEpochMillis(now) - DateTime.toEpochMillis(previous.createdAt);

    const isCurrent = previous !== undefined && ageMs >= 0 && ageMs < maxAgeMs;

    const generation = isCurrent
      ? previous
      : { generation: Base64Url.encode(crypto.getRandomValues(new Uint8Array(GENERATION_BYTES))), createdAt: now };

    const wire = JSON.stringify(Schema.encodeSync(CacheGeneration)(generation));

    localStorage.setItem(scope.key, wire);

    const lease = await acquireGeneration({ scope, generation, signal });

    return { scope, generation, wire, lease };
  });
}

async function retireGeneration({
  scope,
  wire,
}: {
  readonly scope: CacheScope;
  /** Absent when the caller invalidates the scope without owning a generation. */
  readonly wire?: string;
}): Promise<void> {
  await navigator.locks.request(scope.key, { signal: AbortSignal.timeout(Duration.toMillis(CLEANUP_TIMEOUT)) }, () => {
    if (wire === undefined || localStorage.getItem(scope.key) === wire) {
      localStorage.removeItem(scope.key);
    }
  });
}

async function removeRetiredGenerations(scope: CacheScope): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(CACHE_DIRECTORY);
    const scopes = await directory.getDirectoryHandle(scope.name);

    for await (const [name, entry] of scopes.entries()) {
      const decoded = Schema.decodeUnknownResult(GenerationName)(name);

      if (entry.kind === 'directory' && Result.isSuccess(decoded)) {
        await navigator.locks.request(
          createGenerationKey({ scope, generation: name }),
          { ifAvailable: true },
          async (lock) => {
            if (lock !== null && readGeneration(scope)?.generation !== name) {
              await scopes.removeEntry(name, { recursive: true });
            }
          },
        );
      }
    }
  } catch (error) {
    if (!Schema.is(Schema.Struct({ name: Schema.Literal(MISSING_FILE) }))(error)) {
      throw error;
    }
  }
}

async function collectRetiredGenerations(scope: CacheScope): Promise<void> {
  try {
    await waitWithin({
      operation: removeRetiredGenerations(scope),
      timeout: CLEANUP_TIMEOUT,
      message: 'Retired local data could not be removed',
    });
  } catch (error) {
    // The durable pointer already excludes these files; cleanup does not control admission.
    globalThis.reportError(new ConsoleStorageFailed({ reason: String(error) }));
  }
}

/** Retires the selected namespace before any attempt to remove its files. */
export async function discardConsoleStorage(input: ConsoleStorageScope): Promise<boolean> {
  try {
    const scope = await createScope(input);

    await retireGeneration({ scope });
    await collectRetiredGenerations(scope);

    return true;
  } catch {
    return false;
  }
}

async function limitDatabase(database: BrowserWASQLiteDatabase): Promise<void> {
  await database.execute('PRAGMA page_size = 4096');
  await database.execute('PRAGMA journal_mode = DELETE');

  const sizes = await database.execute('PRAGMA page_size');
  const limits = await database.execute('PRAGMA max_page_count = 16384');
  const size = Schema.decodeUnknownResult(Schema.Array(Schema.Struct({ page_size: Schema.Int })))(sizes);
  const limit = Schema.decodeUnknownResult(Schema.Array(Schema.Struct({ max_page_count: Schema.Int })))(limits);

  const hasExpectedSize = Result.isSuccess(size) && size.success[0]?.page_size === CACHE_PAGE_SIZE_BYTES;
  const hasExpectedLimit = Result.isSuccess(limit) && limit.success[0]?.max_page_count === CACHE_MAX_PAGES;

  if (!hasExpectedSize || !hasExpectedLimit) {
    throw new ConsoleStorageFailed({ reason: 'The SQLite page limit could not be applied' });
  }
}

type StorageOwner = SelectedGeneration & {
  readonly database: BrowserWASQLiteDatabase;
  readonly onInvalidated: () => void;
};

function createStorage({ scope, generation, wire, lease, database, onInvalidated }: StorageOwner): ConsoleStorage {
  const nativeClose = database.close;

  if (nativeClose === undefined) {
    throw new ConsoleStorageFailed({ reason: 'The native database has no close operation' });
  }

  const closeDatabase = nativeClose;
  const generationId = CacheGenerationId.make(createGenerationKey({ scope, generation: generation.generation }));
  const coordinator = new BrowserCollectionCoordinator({ dbName: generationId });
  const listeners = new Set<() => void>();

  const state: Types.Mutable<{
    readonly health: ConsoleStorageHealth;
    readonly isClosed: boolean;
    readonly hasPageHidden: boolean;
    /** Absent before the first native close request. */
    readonly closing: Promise<void> | undefined;
    /** Absent before retirement or after a failed retirement attempt. */
    readonly retiring: Promise<void> | undefined;
  }> = { health: {}, isClosed: false, hasPageHidden: false, closing: undefined, retiring: undefined };

  function invalidate(message: string): void {
    if (state.health.issue !== undefined) {
      return;
    }

    state.isClosed = true;
    state.health = { issue: { kind: 'failed', message } };

    onInvalidated();

    for (const listener of listeners) {
      listener();
    }
  }

  function checkGeneration(): void {
    const nowMs = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const current = Result.try(() => localStorage.getItem(scope.key));
    const isExpired = nowMs >= DateTime.toEpochMillis(generation.createdAt) + Duration.toMillis(CACHE_MAX_AGE);
    const hasSelectedGeneration = Result.isSuccess(current) && current.success === wire;

    if (state.isClosed || isExpired || !hasSelectedGeneration) {
      throw new ConsoleStorageFailed({ reason: 'The cache generation is retired' });
    }
  }

  async function retire(): Promise<void> {
    state.retiring ??= retireGeneration({ scope, wire }).catch((error: unknown) => {
      state.retiring = undefined;

      throw new ConsoleStorageFailed({ reason: String(error) });
    });

    await state.retiring;
  }

  async function finishClose(): Promise<void> {
    try {
      await closeDatabase();
    } finally {
      // Native close terminates its Worker even when closing the connection rejects.
      await lease.release();
      globalThis.removeEventListener('pagehide', onPageHide, true);
      globalThis.removeEventListener('pagehide', releaseOnPageHide);
    }
  }

  async function close(): Promise<void> {
    state.isClosed = true;

    clearTimeout(expiration);
    globalThis.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    coordinator.dispose();

    state.closing ??= finishClose();

    try {
      await waitWithin({
        operation: state.closing,
        timeout: CLEANUP_TIMEOUT,
        message: 'Local storage did not close. Reopen this workspace',
      });
    } catch (error) {
      if (state.hasPageHidden && state.health.issue === undefined) {
        return;
      }

      invalidate('Local storage stopped responding. Reopen this workspace');
      await retire();

      throw error;
    }
  }

  async function discard(): Promise<void> {
    invalidate('Local data was reset. Reopen this workspace');

    try {
      await retire();
    } finally {
      // Retirement failure must not leave a failed connection accepting work.
      await close().catch(() => invalidate('Local storage could not be closed. Reopen this workspace'));
    }

    await collectRetiredGenerations(scope);
  }

  function onStorage(event: StorageEvent): void {
    if (event.key !== scope.key && event.key !== null) {
      return;
    }

    const current = Result.try(() => localStorage.getItem(scope.key));

    if (Result.isFailure(current) || current.success !== wire) {
      invalidate('Local data was reset in another tab. Reopen this workspace');
      void close().catch(() => invalidate('Local storage could not be closed. Reopen this workspace'));
    }
  }

  function onPageHide(): void {
    state.isClosed = true;
    state.hasPageHidden = true;

    coordinator.dispose();
  }

  function releaseOnPageHide(): void {
    // The native opener's earlier bubble listener has already terminated its Worker.
    void lease.release();
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && !state.isClosed) {
      const current = Result.try(checkGeneration);

      if (Result.isFailure(current)) {
        void discard().catch(() => invalidate('Local data could not be reset. Try again'));
      }
    }
  }

  // This public native database method forwards its caller-owned row type without an assertion.
  // ast-grep-ignore: return-only-type-parameter
  async function execute<Row = unknown>(sql: string, params?: ReadonlyArray<unknown>): Promise<ReadonlyArray<Row>> {
    try {
      checkGeneration();

      const rows = await waitWithin({
        operation: database.execute<Row>(sql, params),
        timeout: OPERATION_TIMEOUT,
        message: 'Local storage stopped responding. Reopen this workspace',
      });

      checkGeneration();

      return rows;
    } catch (error) {
      if (state.isClosed && state.health.issue === undefined) {
        throw error;
      }

      // Native schema preparation handles expected SQLite errors, such as an existing migration column.
      if (!Schema.is(ConsoleStorageFailed)(error)) {
        throw error;
      }

      invalidate('Local storage could not be updated. Reopen this workspace');

      try {
        await retire();
      } finally {
        void close().catch(() => invalidate('Local storage could not be closed. Reopen this workspace'));
      }

      throw error;
    }
  }

  const remainingMs = Math.max(
    0,
    DateTime.toEpochMillis(generation.createdAt) +
      Duration.toMillis(CACHE_MAX_AGE) -
      DateTime.toEpochMillis(DateTime.nowUnsafe()),
  );

  const expiration = setTimeout(() => {
    void discard().catch(() => invalidate('Local data could not be reset. Try again'));
  }, remainingMs);

  globalThis.addEventListener('storage', onStorage);
  globalThis.addEventListener('pagehide', onPageHide, { capture: true });
  globalThis.addEventListener('pagehide', releaseOnPageHide);
  document.addEventListener('visibilitychange', onVisibilityChange);

  const persistence = createBrowserWASQLitePersistence({ database: { execute, close }, coordinator });

  return {
    generationId,
    persistence,
    dispose: close,
    discard,
    readHealth: () => state.health,
    subscribeHealth(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}

/** Opens one required persistent owner after the caller has admitted its principal and workspace. */
export async function openConsoleStorage(input: OpenConsoleStorage): Promise<ConsoleStorage> {
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(Duration.toMillis(OPEN_TIMEOUT))]);
  const startedAtMs = DateTime.toEpochMillis(DateTime.nowUnsafe());

  async function select(): Promise<SelectedGeneration> {
    try {
      const scope = await createScope(input);

      return await selectGeneration({ scope, signal });
    } catch (error) {
      throw new ConsoleStorageFailed({ reason: String(error) });
    }
  }

  const selected = await select();
  const { scope } = selected;

  const state: Types.Mutable<{
    /** Absent until the native opener returns a connection. */
    readonly database: BrowserWASQLiteDatabase | undefined;
    /** Absent until the connection has its scoped lifecycle owner. */
    readonly storage: ConsoleStorage | undefined;
  }> = { database: undefined, storage: undefined };

  async function closeFailedOpen(): Promise<void> {
    try {
      await state.database?.close?.();
    } finally {
      await selected.lease.release();
    }
  }

  try {
    const databaseName = createDatabasePath({ scope, generation: selected.generation.generation });

    state.database = await openBrowserWASQLiteOPFSDatabase({
      databaseName,
      timeoutMs: Duration.toMillis(OPEN_TIMEOUT),
      signal,
    });

    state.storage = createStorage({ ...selected, database: state.database, onInvalidated: input.onInvalidated });

    await waitWithin({
      operation: limitDatabase(state.database),
      timeout: Duration.millis(
        Math.max(0, Duration.toMillis(OPEN_TIMEOUT) - (DateTime.toEpochMillis(DateTime.nowUnsafe()) - startedAtMs)),
      ),
      message: 'Local storage could not be prepared. Try again',
    });

    signal.throwIfAborted();

    if (localStorage.getItem(scope.key) !== selected.wire) {
      throw new ConsoleStorageFailed({ reason: 'The cache generation changed during startup' });
    }

    void collectRetiredGenerations(scope);

    return state.storage;
  } catch (error) {
    const wasCanceled = input.signal.aborted && state.storage?.readHealth().issue === undefined;

    if (wasCanceled) {
      if (state.storage === undefined) {
        await waitWithin({
          operation: closeFailedOpen(),
          timeout: CLEANUP_TIMEOUT,
          message: 'Local storage did not close',
        });
      } else {
        await state.storage.dispose();
      }

      throw error;
    }

    if (state.storage === undefined) {
      try {
        await retireGeneration({ scope, wire: selected.wire });
      } finally {
        await waitWithin({
          operation: closeFailedOpen(),
          timeout: CLEANUP_TIMEOUT,
          message: 'Local storage did not close. Try again',
        });
      }
    } else {
      await state.storage.discard();
    }

    throw new ConsoleStorageFailed({ reason: String(error) });
  }
}
