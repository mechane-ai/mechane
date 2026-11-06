import { Bytes, BYTES_PER_MEBIBYTE } from '@mechane/records';
import type { PrincipalId, WorkspaceId } from '@mechane/records';
import { createSQLiteCorePersistenceAdapter } from '@tanstack/db-sqlite-persistence-core';
import type { PersistedCollectionPersistence } from '@tanstack/db-sqlite-persistence-core';
import { DateTime, Duration, Result, Schema } from 'effect';
import type { Types } from 'effect';
import { openConnection } from './connection';
import type { StoreConnection } from './connection';
import { StoreCommand, StoreFailed } from './protocol';

const STORAGE_MODE = { Persistent: 'persistent', Memory: 'memory' } as const;
const ISSUE_KIND = { Unavailable: 'unavailable', Failed: 'failed' } as const;
const FORMAT_GENERATION = 1;
const OPEN_TIMEOUT_MS = 500;
const DISCARD_TIMEOUT_MS = Duration.toMillis('3 seconds');
const CACHE_MAX_AGE = Duration.hours(24);
const CACHE_MAX_MEBIBYTES = 64;
const CACHE_MAX_BYTES = Bytes.make(CACHE_MAX_MEBIBYTES * BYTES_PER_MEBIBYTE);
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

type ConsoleStorageIssue = { readonly kind: (typeof ISSUE_KIND)[keyof typeof ISSUE_KIND]; readonly message: string };

/** Reports the selected storage mode and its first observed failure. */
export type ConsoleStorageHealth = {
  readonly mode: (typeof STORAGE_MODE)[keyof typeof STORAGE_MODE];
  /** Absent when the selected mode has reported no storage failure. */
  readonly issue?: ConsoleStorageIssue;
};

type ConsoleStorage = {
  /** Absent when this runtime selected memory storage. */
  readonly persistence?: PersistedCollectionPersistence;
  readonly dispose: () => Promise<void>;
  readonly discard: () => Promise<void>;
  readonly readHealth: () => ConsoleStorageHealth;
  readonly subscribeHealth: (listener: () => void) => () => void;
};

type MemoryStorageInput = {
  /** Absent when the caller deliberately selected memory storage. */
  readonly issue?: ConsoleStorageIssue;
};

type ConsoleStorageScope = {
  readonly origin: string;
  readonly principalId: PrincipalId;
  readonly workspaceId: WorkspaceId;
};

type OpenConsoleStorageInput = ConsoleStorageScope & { readonly signal: AbortSignal };

type FileLease = { readonly isOwner: boolean; readonly release: () => Promise<void> };
type AcquireFileInput = { readonly file: string; readonly signal: AbortSignal };
type HealthState = { readonly snapshot: ConsoleStorageHealth };

type StorageHealth = {
  readonly read: () => ConsoleStorageHealth;
  readonly fail: () => void;
  readonly subscribe: (listener: () => void) => () => void;
};

type ResourceState = {
  /** Absent until a persistent storage owner has been constructed. */
  readonly storage: ConsoleStorage | undefined;
};

type DisposalState = {
  /** Absent until the first dispose or discard request. */
  readonly pending: Promise<void> | undefined;
  readonly hasDiscarded: boolean;
  readonly shouldDiscard: boolean;
};

type PersistentStorageInput = {
  readonly file: string;
  readonly lease: FileLease;
  readonly connection: StoreConnection;
  readonly expiresAt: DateTime.Utc;
  readonly signal: AbortSignal;
  readonly health: StorageHealth;
};

/** Selects memory storage with no worker, file lease, or later persistence promotion. */
export function createMemoryStorage({ issue }: MemoryStorageInput = {}): ConsoleStorage {
  const health: ConsoleStorageHealth = { mode: STORAGE_MODE.Memory, ...(issue !== undefined && { issue }) };

  return {
    dispose: async () => undefined,
    discard: async () => undefined,
    readHealth: () => health,
    subscribeHealth: () => () => undefined,
  };
}

async function acquireFile({ file, signal }: AcquireFileInput): Promise<FileLease> {
  const acquired = Promise.withResolvers<boolean>();
  const released = Promise.withResolvers<void>();

  const held = navigator.locks.request(file, { ifAvailable: true }, async (lock) => {
    if (lock === null || signal.aborted) {
      acquired.resolve(false);

      return;
    }

    acquired.resolve(true);
    await released.promise;
  });

  void held.catch((failure: unknown) => {
    acquired.reject(failure);
  });

  const isOwner = await acquired.promise;

  return {
    isOwner,
    async release() {
      released.resolve();
      await held;
    },
  };
}

function createHealth(): StorageHealth {
  const state: Types.Mutable<HealthState> = { snapshot: { mode: STORAGE_MODE.Persistent } };
  const listeners = new Set<() => void>();

  return {
    read: () => state.snapshot,
    fail() {
      if (state.snapshot.issue !== undefined) {
        return;
      }

      state.snapshot = {
        mode: STORAGE_MODE.Persistent,
        issue: {
          kind: ISSUE_KIND.Failed,
          message: 'Local storage stopped working. Continue online to load a fresh copy',
        },
      };

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}

async function scopeFile({ origin, principalId, workspaceId }: ConsoleStorageScope): Promise<string> {
  const scope = JSON.stringify([FORMAT_GENERATION, origin, principalId, workspaceId]);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(scope);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  const parts = Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'));

  return `mechane-console-cache-${FORMAT_GENERATION}-${parts.join('')}.db`;
}

async function discardFile(file: string, signal?: AbortSignal): Promise<void> {
  const lifetime = new AbortController();
  const signals = [lifetime.signal];

  if (signal !== undefined) {
    signals.push(signal);
  }

  const combined = AbortSignal.any(signals);

  const timeout = setTimeout(() => {
    const failure = new StoreFailed({ reason: 'Cache removal timed out' });

    lifetime.abort(failure);
  }, DISCARD_TIMEOUT_MS);

  const command = StoreCommand.cases.Discard.make({ file });

  try {
    const connection = await openConnection({ command, signal: combined, onFailure: () => undefined });

    connection.terminate();
  } finally {
    clearTimeout(timeout);
  }
}

function canAccessFiles(): boolean {
  const hasWorker = typeof Worker !== 'undefined';
  const hasLocks = Reflect.has(navigator, 'locks');
  const hasDirectory = Reflect.has(navigator, 'storage') && Reflect.has(navigator.storage, 'getDirectory');

  return hasWorker && hasLocks && hasDirectory;
}

/** Invalidates only the named scope when its file lease can be acquired within the cleanup budget. */
export async function discardConsoleStorage(scope: ConsoleStorageScope): Promise<boolean> {
  if (!canAccessFiles()) {
    return false;
  }

  const lifetime = new AbortController();
  const expired = Promise.withResolvers<false>();

  const timer = setTimeout(() => {
    const failure = new StoreFailed({ reason: 'Cache invalidation timed out' });

    lifetime.abort(failure);
    expired.resolve(false);
  }, DISCARD_TIMEOUT_MS);

  async function discard(): Promise<boolean> {
    const file = await scopeFile(scope);

    lifetime.signal.throwIfAborted();

    const lease = await acquireFile({ file, signal: lifetime.signal });

    try {
      if (!lease.isOwner) {
        return false;
      }

      lifetime.signal.throwIfAborted();
      await discardFile(file, lifetime.signal);

      return true;
    } finally {
      await lease.release();
    }
  }

  try {
    const discarded = discard();

    return await Promise.race([discarded, expired.promise]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function createPersistentStorage({
  file,
  lease,
  connection,
  expiresAt,
  signal,
  health,
}: PersistentStorageInput): ConsoleStorage {
  const state: Types.Mutable<DisposalState> = { pending: undefined, hasDiscarded: false, shouldDiscard: false };
  const adapter = createSQLiteCorePersistenceAdapter({ driver: connection.driver });
  const persistence: PersistedCollectionPersistence = { adapter };
  const expiresAtMs = DateTime.toEpochMillis(expiresAt);
  const remainingMs = Math.max(0, expiresAtMs - Date.now());

  const expiration = setTimeout(() => {
    connection.terminate();
    void discard();
    health.fail();
  }, remainingMs);

  async function close(): Promise<void> {
    clearTimeout(expiration);
    signal.removeEventListener('abort', abort);

    try {
      try {
        await connection.close();
      } catch {
        state.shouldDiscard = true;

        health.fail();
      }

      if (state.shouldDiscard) {
        await discardFile(file);

        state.hasDiscarded = true;
      }
    } catch {
      health.fail();
    } finally {
      connection.terminate();
      await lease.release();
    }
  }

  async function dispose(): Promise<void> {
    state.pending ??= close();

    await state.pending;
  }

  async function discard(): Promise<void> {
    state.shouldDiscard = true;

    if (state.pending === undefined) {
      state.pending = close();

      await state.pending;

      return;
    }

    await state.pending;

    if (state.hasDiscarded) {
      return;
    }

    const lifetime = new AbortController();
    const nextLease = await acquireFile({ file, signal: lifetime.signal });

    if (!nextLease.isOwner) {
      health.fail();

      return;
    }

    try {
      await discardFile(file);

      state.hasDiscarded = true;
    } catch {
      health.fail();
    } finally {
      await nextLease.release();
    }
  }

  function abort(): void {
    connection.terminate();
    void discard();
  }

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    abort();
  }

  return { persistence, dispose, discard, readHealth: health.read, subscribeHealth: health.subscribe };
}

/** Selects persistence within the startup budget; its signal owns admission, then the returned owner owns cleanup. */
export async function openConsoleStorage({
  origin,
  principalId,
  workspaceId,
  signal,
}: OpenConsoleStorageInput): Promise<ConsoleStorage> {
  if (!globalThis.crossOriginIsolated || !canAccessFiles()) {
    return createMemoryStorage({
      issue: { kind: ISSUE_KIND.Unavailable, message: 'This browser uses memory because local storage is unavailable' },
    });
  }

  const lifetime = new AbortController();
  const aborted = Promise.withResolvers<never>();
  const state: Types.Mutable<ResourceState> = { storage: undefined };
  const health = createHealth();

  function abort(): void {
    const reason: unknown = signal.reason;

    lifetime.abort(reason);
  }

  lifetime.signal.addEventListener(
    'abort',
    () => {
      const reason: unknown = lifetime.signal.reason;

      aborted.reject(reason);
    },
    { once: true },
  );

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    abort();
  }

  const timeout = setTimeout(() => {
    const failure = new StoreFailed({ reason: 'Cache initialization timed out' });

    lifetime.abort(failure);
  }, OPEN_TIMEOUT_MS);

  async function open(): Promise<ConsoleStorage> {
    const file = await scopeFile({ origin, principalId, workspaceId });

    lifetime.signal.throwIfAborted();

    const lease = await acquireFile({ file, signal: lifetime.signal });

    if (!lease.isOwner) {
      await lease.release();

      return createMemoryStorage({
        issue: { kind: ISSUE_KIND.Unavailable, message: 'This tab uses memory because another tab owns local storage' },
      });
    }

    try {
      lifetime.signal.throwIfAborted();

      const command = StoreCommand.cases.Open.make({ file, maxAge: CACHE_MAX_AGE, maxBytes: CACHE_MAX_BYTES });

      const connection = await openConnection({
        command,
        signal: lifetime.signal,
        onFailure() {
          void state.storage?.discard();
          health.fail();
        },
      });

      const decoded = Schema.decodeUnknownResult(Schema.DateTimeUtcFromMillis, { onExcessProperty: 'error' })(
        connection.initialValue,
      );

      if (Result.isFailure(decoded)) {
        connection.terminate();

        throw new StoreFailed({ reason: String(decoded.failure) });
      }

      lifetime.signal.throwIfAborted();

      state.storage = createPersistentStorage({
        file,
        lease,
        connection,
        expiresAt: decoded.success,
        signal: lifetime.signal,
        health,
      });

      return state.storage;
    } catch (failure) {
      lifetime.abort(failure);

      try {
        await discardFile(file);
      } catch {
        health.fail();
      } finally {
        await lease.release();
      }

      throw failure;
    }
  }

  try {
    const opening = open();
    const storage = await Promise.race([opening, aborted.promise]);

    return storage;
  } catch {
    return createMemoryStorage({
      issue: { kind: ISSUE_KIND.Unavailable, message: 'Local storage could not open. This session uses memory' },
    });
  } finally {
    clearTimeout(timeout);

    signal.removeEventListener('abort', abort);
  }
}
