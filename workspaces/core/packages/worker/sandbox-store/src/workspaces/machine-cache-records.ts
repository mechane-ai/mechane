import { MachineId, NativeSnapshotId, RecordText, SHA256_PATTERN } from '@mechane/records';
import { NativeSnapshotReport } from '@mechane/sandbox-wire';
import { decodeCache } from '@mechane/store';
import { Option, Schema } from 'effect';

const CACHE_KEY = 'workspace-cache';
const ACTIVE_KEY = 'active-workspace-cache';
const REPORT_KEY = 'workspace-cache-report';
const cacheKeyPattern = Schema.isPattern(SHA256_PATTERN);
const CacheKey = Schema.String.check(cacheKeyPattern);

export const MachineCacheSnapshot = Schema.Struct({
  key: CacheKey,
  snapshotId: NativeSnapshotId,
  bytes: Schema.Number,
  expiresAt: Schema.DateTimeUtcFromMillis,
});

export type MachineCacheSnapshot = typeof MachineCacheSnapshot.Type;

const MachineCacheSelection = Schema.Struct({
  machineId: MachineId,
  configuration: RecordText,
  key: Schema.OptionFromNullOr(CacheKey),
});

export type MachineCacheSelection = typeof MachineCacheSelection.Type;

type CacheStoreInput = { readonly storage: Pick<DurableObjectStorage, 'get' | 'put'> };

type SaveCacheInput = { readonly value: MachineCacheSnapshot };
type SaveSelectionInput = { readonly value: MachineCacheSelection };
type SaveReportInput = { readonly value: NativeSnapshotReport };
type MachineIdentity = { readonly machineId: MachineId };

type MachineCacheStore = {
  readonly readCache: () => Promise<Option.Option<MachineCacheSnapshot>>;
  readonly readSelection: () => Promise<Option.Option<MachineCacheSelection>>;
  readonly saveCache: (input: SaveCacheInput) => Promise<void>;
  readonly saveSelection: (input: SaveSelectionInput) => Promise<void>;
  readonly invalidateSelected: (input: MachineIdentity) => Promise<void>;
  readonly readReport: () => Promise<Option.Option<NativeSnapshotReport>>;
  readonly saveReport: (input: SaveReportInput) => Promise<void>;
};

/** Disposable provider metadata never owns a portable workspace head. */
export function machineCacheRecords({ storage }: CacheStoreInput): MachineCacheStore {
  async function readCache(): Promise<Option.Option<MachineCacheSnapshot>> {
    const raw = await storage.get(CACHE_KEY);

    return decodeCache({ value: raw, schema: MachineCacheSnapshot });
  }

  async function readSelection(): Promise<Option.Option<MachineCacheSelection>> {
    const raw = await storage.get(ACTIVE_KEY);

    return decodeCache({ value: raw, schema: MachineCacheSelection });
  }

  return {
    readCache,
    readSelection,
    readReport: async () => {
      const raw = await storage.get(REPORT_KEY);

      return decodeCache({ value: raw, schema: NativeSnapshotReport });
    },
    saveReport: async ({ value }) => {
      const encoded = Schema.encodeSync(NativeSnapshotReport)(value);

      await storage.put(REPORT_KEY, encoded);
    },
    saveCache: async ({ value }) => {
      const encoded = Schema.encodeSync(MachineCacheSnapshot)(value);

      await storage.put(CACHE_KEY, encoded);
    },
    saveSelection: async ({ value }) => {
      const encoded = Schema.encodeSync(MachineCacheSelection)(value);

      await storage.put(ACTIVE_KEY, encoded);
    },
    invalidateSelected: async ({ machineId }) => {
      const active = await readSelection();
      const cached = await readCache();

      if (Option.isNone(active) || Option.isNone(cached)) {
        return;
      }

      if (active.value.machineId === machineId && Option.contains(active.value.key, cached.value.key)) {
        await storage.put(CACHE_KEY, null);
      }
    },
  };
}
