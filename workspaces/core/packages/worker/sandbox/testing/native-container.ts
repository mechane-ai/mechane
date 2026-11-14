import { SandboxContainerNetwork } from '@mechane/deployment';
import { MachineId, RecordId } from '@mechane/records';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { Deferred, Effect, Option } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { containerProvider } from '../src/providers/container-provider.ts';
import type { ContainerProviderInput } from '../src/providers/types.ts';
import type { MachineProvider, MachineStartInput } from '../src/types.ts';

const machineId = MachineId.make('d0649924-d872-4d32-9ec7-23e663c81cd0');
const input: Readonly<MachineStartInput> = { machineId, checkpoint: Option.none<WorkspaceSnapshot>() };
const DIGEST_CHARACTERS = 64;
const CACHE_BYTES = 1024;
const INITIAL_AND_SNAPSHOT_ATTEMPTS = 2;
const PORTABLE_FALLBACK_ATTEMPTS = 3;

type FixtureInput = {
  readonly isRunning?: boolean;
  readonly labels?: Readonly<Record<string, string>>;
  readonly inspectionError?: Error;
  readonly isMetadataMissing?: boolean;
  readonly shouldRejectSnapshot?: boolean;
  readonly shouldRetainSnapshotInstance?: boolean;
  readonly shouldStopDuringInspection?: boolean;
};

type NativeFixture = {
  readonly provider: MachineProvider;
  readonly snapshotError: Error;
  readonly counts: () => {
    readonly starts: number;
    readonly destroys: number;
    readonly inspections: number;
    readonly snapshotStarts: number;
    readonly startRequests: number;
  };
  readonly settle: () => Promise<void>;
};

function createNativeFixture({
  isRunning = false,
  labels = {},
  inspectionError,
  isMetadataMissing = false,
  shouldRejectSnapshot = false,
  shouldRetainSnapshotInstance = false,
  shouldStopDuringInspection = false,
}: FixtureInput = {}): NativeFixture {
  let running = isRunning;
  let activeLabels = labels;
  let starts = 0;
  let destroys = 0;
  let inspections = 0;
  let snapshotStarts = 0;
  let startRequests = 0;
  const snapshotError = new Error('snapshot cannot be restored');
  let stopped = Deferred.makeUnsafe<void>();
  const observations: Array<Promise<unknown>> = [];
  const stored = new Map<string, unknown>();

  const container: Container = {
    images: {},
    get running() {
      return running;
    },
    inspect: async () => {
      inspections += 1;

      if (!running) {
        throw new Error('The container has not been started');
      }

      if (inspectionError !== undefined) {
        throw inspectionError;
      }

      if (isMetadataMissing) {
        return null;
      }

      if (shouldStopDuringInspection) {
        running = false;

        await Effect.runPromise(Deferred.succeed(stopped, undefined));
      }

      return { image: 'qualified-image', labels: activeLabels };
    },
    start: (options = {}) => {
      startRequests += 1;

      assert.equal(running, false, 'a live instance cannot start twice');

      if (options.containerSnapshot !== undefined) {
        snapshotStarts += 1;

        if (shouldRejectSnapshot) {
          if (shouldRetainSnapshotInstance) {
            running = true;
            activeLabels = options.labels ?? {};
            stopped = Deferred.makeUnsafe<void>();
          }

          throw snapshotError;
        }
      }

      starts += 1;
      running = true;
      activeLabels = options.labels ?? {};
      stopped = Deferred.makeUnsafe<void>();
    },
    monitor: () => Effect.runPromise(Deferred.await(stopped)),
    destroy: async () => {
      assert.equal(running, true, 'a stopped instance needs no destroy');

      destroys += 1;
      running = false;

      await Effect.runPromise(Deferred.succeed(stopped, undefined));
    },
    setInactivityTimeout: async () => {
      assert.equal(running, true);
    },
    getTcpPort: () => {
      throw new Error('guest identity is unavailable');
    },
    interceptOutboundHttp: async () => {
      throw new Error('direct fixture does not intercept HTTP');
    },
    interceptOutboundHttps: async () => {
      throw new Error('direct fixture does not intercept HTTPS');
    },
    interceptAllOutboundHttp: async () => {
      throw new Error('direct fixture does not intercept HTTP');
    },
    snapshotContainer: async () => ({ id: '3fe5c8b3-2628-47b7-a58e-1721e8e415de', size: CACHE_BYTES }),
    signal: () => {
      throw new Error('fixture does not signal processes');
    },
    exec: async () => {
      throw new Error('fixture does not execute commands');
    },
  };

  const memoryStorage = {
    get: async (key: string): Promise<unknown> => stored.get(key),
    put: async (key: string, value: unknown): Promise<void> => {
      stored.set(key, value);
    },
  };

  // The native fixture adapts the generic DurableObjectStorage overloads to its in-memory map.
  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- SDK
  const storage = memoryStorage as Pick<DurableObjectStorage, 'get' | 'put'>;

  const state: ContainerProviderInput['state'] = {
    storage,
    waitUntil: (promise) => {
      observations.push(promise);
    },
    blockConcurrencyWhile: async (run) => await run(),
  };

  const provider = containerProvider({
    container,
    state,
    onStartupExit: () => {
      assert.equal(container.running, false);
    },
    gateway: () => {
      throw new Error('direct network needs no gateway');
    },
    containerNetwork: SandboxContainerNetwork.Direct,
    additionalTools: [],
    isBrowserSandboxDisabled: true,
    trustedCertificatesPem: Option.none(),
    nativeImage: Option.some(`registry.example.invalid/qualified@sha256:${'a'.repeat(DIGEST_CHARACTERS)}`),
    instance: 'standard-1',
  });

  return {
    provider,
    snapshotError,
    counts: () => ({ starts, destroys, inspections, snapshotStarts, startRequests }),
    settle: async () => {
      await Promise.all(observations);
    },
  };
}

await test(
  'cold native lifecycle avoids unstarted inspection and rejoins the same instance',
  { timeout: 5000 },
  async () => {
    const fixture = createNativeFixture();

    assert.equal(await fixture.provider.isAbsent({ machineId }), true);
    await fixture.provider.stop(input);
    assert.equal(fixture.counts().inspections, 0);
    await fixture.provider.start(input);
    assert.equal(await fixture.provider.isAbsent({ machineId }), false);
    await fixture.provider.start(input);
    assert.equal(fixture.counts().starts, 1);
    await fixture.provider.stop(input);
    await fixture.settle();
    assert.equal(await fixture.provider.isAbsent({ machineId }), true);
    await fixture.provider.stop(input);
    assert.equal(fixture.counts().destroys, 1);

    const stopped = createNativeFixture({
      isRunning: true,
      labels: { 'mechane.machine': machineId },
      shouldStopDuringInspection: true,
    });

    await stopped.provider.stop(input);
    assert.equal(await stopped.provider.isAbsent({ machineId }), true);
    assert.equal(stopped.counts().destroys, 0);
  },
);

await test('present native instances retain their identity and inspection failures', { timeout: 5000 }, async () => {
  const inspectionError = new Error('inspection unavailable');

  const fixtures = [
    createNativeFixture({ isRunning: true, labels: { 'mechane.machine': 'another-machine' } }),
    createNativeFixture({ isRunning: true, isMetadataMissing: true }),
  ];

  for (const fixture of fixtures) {
    await assert.rejects(fixture.provider.start(input));
    await assert.rejects(fixture.provider.stop(input));
    assert.equal(await fixture.provider.isAbsent({ machineId }), false);
    assert.equal(fixture.counts().starts, 0);
    assert.equal(fixture.counts().destroys, 0);
  }

  const unavailable = createNativeFixture({ isRunning: true, inspectionError });

  await assert.rejects(unavailable.provider.start(input), (actual) => actual === inspectionError);
  await assert.rejects(unavailable.provider.stop(input), (actual) => actual === inspectionError);
  assert.equal(await unavailable.provider.isAbsent({ machineId }), false);
  assert.equal(unavailable.counts().destroys, 0);
});

await test(
  'rejected native snapshot falls back only while the physical instance is absent',
  { timeout: 5000 },
  async () => {
    const checkpoint: WorkspaceSnapshot = {
      generation: RecordId.make('430c3686-eac7-4cfa-9ca9-523d31b6d09c'),
      parent: Option.none(),
      archive: { bytes: 0, parts: 0, sha256: 'a'.repeat(DIGEST_CHARACTERS) },
      manifestSha256: Option.some('b'.repeat(DIGEST_CHARACTERS)),
      capturedMachineId: Option.some(machineId),
      capturedAt: Option.none(),
      capturedSequence: Option.none(),
    };

    const saved = { machineId, checkpoint: Option.some(checkpoint) };

    for (const shouldRetainSnapshotInstance of [false, true]) {
      const fixture = createNativeFixture({ shouldRejectSnapshot: true, shouldRetainSnapshotInstance });

      await fixture.provider.start(saved);
      await fixture.provider.stop(saved);
      await fixture.settle();

      if (shouldRetainSnapshotInstance) {
        await assert.rejects(fixture.provider.start(saved), (actual) => actual === fixture.snapshotError);
        assert.equal(fixture.counts().startRequests, INITIAL_AND_SNAPSHOT_ATTEMPTS);
        assert.equal(await fixture.provider.isAbsent({ machineId }), false);
      } else {
        await fixture.provider.start(saved);
        assert.equal(fixture.counts().startRequests, PORTABLE_FALLBACK_ATTEMPTS);
      }

      assert.equal(fixture.counts().snapshotStarts, 1);
      await fixture.provider.stop(input);
      await fixture.settle();
    }
  },
);
