import { MachineId, NativeSnapshotId, RecordText, SHA256_PATTERN } from '@mechane/records';
import { NativeSnapshotCaptureStatus, NativeSnapshotReport } from '@mechane/sandbox-wire';
import type { NativeSnapshotCapture } from '@mechane/sandbox-wire';
import { decodeCache } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';

const CACHE_KEY = 'workspace-cache';
const ACTIVE_KEY = 'active-workspace-cache';
const REPORT_KEY = 'workspace-cache-report';
const cacheKeyPattern = Schema.isPattern(SHA256_PATTERN);
const CacheKey = Schema.String.check(cacheKeyPattern);

export const MachineCacheSnapshot = Schema.Struct({
  key: CacheKey,
  snapshotId: NativeSnapshotId,
  bytes: Schema.Number,
  capturedAt: Schema.DateTimeUtcFromMillis,
  expiresAt: Schema.DateTimeUtcFromMillis,
});

export type MachineCacheSnapshot = typeof MachineCacheSnapshot.Type;

const MachineCacheSelection = Schema.Struct({
  machineId: MachineId,
  configuration: RecordText,
  key: Schema.OptionFromNullOr(CacheKey),
});

export type MachineCacheSelection = typeof MachineCacheSelection.Type;

type CacheStoreInput = { readonly storage: Pick<DurableObjectStorage, 'get' | 'put' | 'transaction'> };

type SaveCacheInput = {
  readonly value: MachineCacheSnapshot;
  readonly machineId: MachineId;
  readonly configuration: string;
};

type SaveSelectionInput = { readonly value: MachineCacheSelection };
type SaveReportInput = { readonly value: NativeSnapshotReport };
type SaveCaptureInput = { readonly observation: NativeSnapshotCapture };
type MachineIdentity = { readonly machineId: MachineId };

type MachineCacheStore = {
  readonly readCache: () => Promise<Option.Option<MachineCacheSnapshot>>;
  readonly readSelection: () => Promise<Option.Option<MachineCacheSelection>>;
  readonly saveCache: (input: SaveCacheInput) => Promise<boolean>;
  readonly saveSelection: (input: SaveSelectionInput) => Promise<void>;
  readonly invalidateSelected: (input: MachineIdentity) => Promise<void>;
  readonly readReport: () => Promise<Option.Option<NativeSnapshotReport>>;
  readonly saveReport: (input: SaveReportInput) => Promise<void>;
  readonly saveCapture: (input: SaveCaptureInput) => Promise<void>;
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
    saveCache: async ({ value, machineId, configuration }) =>
      await storage.transaction(async (transaction) => {
        const raw = await transaction.get(ACTIVE_KEY);
        const active = decodeCache({ value: raw, schema: MachineCacheSelection });

        if (
          !Option.exists(
            active,
            (selected) => selected.machineId === machineId && selected.configuration === configuration,
          )
        ) {
          return false;
        }

        const cachedRaw = await transaction.get(CACHE_KEY);
        const cached = decodeCache({ value: cachedRaw, schema: MachineCacheSnapshot });

        if (
          Option.exists(cached, (snapshot) => DateTime.isGreaterThanOrEqualTo(snapshot.capturedAt, value.capturedAt))
        ) {
          return false;
        }

        const encoded = Schema.encodeSync(MachineCacheSnapshot)(value);

        await transaction.put(CACHE_KEY, encoded);

        return true;
      }),
    saveCapture: async ({ observation }) => {
      await storage.transaction(async (transaction) => {
        const raw = await transaction.get(REPORT_KEY);
        const report = decodeCache({ value: raw, schema: NativeSnapshotReport });

        if (Option.isNone(report) || report.value.machineId !== observation.machineId) {
          return;
        }

        const current = report.value.capture;

        if (Option.isSome(current)) {
          if (DateTime.isGreaterThan(current.value.at, observation.at)) {
            return;
          }

          if (
            observation.status !== NativeSnapshotCaptureStatus.Capturing &&
            DateTime.toEpochMillis(current.value.at) === DateTime.toEpochMillis(observation.at) &&
            current.value.generation !== observation.generation
          ) {
            return;
          }

          if (
            observation.status === NativeSnapshotCaptureStatus.TimedOut &&
            current.value.status !== NativeSnapshotCaptureStatus.Capturing
          ) {
            return;
          }
        }

        const value = { ...report.value, capture: Option.some(observation) };
        const encoded = Schema.encodeSync(NativeSnapshotReport)(value);

        await transaction.put(REPORT_KEY, encoded);
      });
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
