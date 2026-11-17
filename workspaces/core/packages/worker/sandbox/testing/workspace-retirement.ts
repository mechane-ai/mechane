import { Bytes, MachineId, RecordId, SandboxOperationId } from '@mechane/records';
import { ExecutionStatus, FileCheckpointPurpose } from '@mechane/sandbox-store';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { ReceiptStatus, SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Deferred, Duration, Effect, Option, Result } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitCheckpoint } from '../src/checkpoints/commit-checkpoint.ts';
import { managePortable } from '../src/maintenance/manage-portable.ts';
import type { MachineProvider, WorkspaceFiles } from '../src/types.ts';
import { sqliteStore } from './store/sqlite-store.ts';

const machineId = MachineId.make('d59354ae-4ab0-43b1-a2ba-e1ef281f4709');
const generation = RecordId.make('b069f632-7b10-4e16-8fca-126dd5b229ff');
const previous = RecordId.make('10286748-5ffb-46f9-8d37-cf9739da9cda');
const operationId = SandboxOperationId.make('34995087-fe48-4793-8564-eb2a3bf1d76c');
const checkpointId = SandboxOperationId.make('498bf63b-1d9d-4c96-aaf2-b755c1bbf780');
const terminalId = 'b65c148e-77c3-4272-bd86-5cbf58b61ea2';
const dispatchedId = '50fb650d-7992-4f8c-9e8a-45dd8752860d';
const archive = { bytes: 1, parts: 1, sha256: 'a'.repeat(64) } as const;
const request = { action: SandboxAction.Delete, operationId: Option.some(operationId) } as const;

type FixtureInput = { readonly beforePut?: () => Promise<void> };

function fixtureObject({ key }: { readonly key: string }): R2Object {
  return {
    key,
    version: 'fixture',
    size: 1,
    etag: 'fixture',
    httpEtag: '"fixture"',
    checksums: { toJSON: () => ({}) },
    uploaded: new Date(0),
    storageClass: 'Standard',
    writeHttpMetadata: () => undefined,
  };
}

function retirementFixture({ beforePut = async () => undefined }: FixtureInput = {}) {
  const database = sqliteStore();
  const store = database.store;
  const now = DateTime.nowUnsafe();
  const objects = new Set<string>([`sandboxes/retirement/${previous}/manifest.json`]);

  const snapshot: WorkspaceSnapshot = {
    generation: previous,
    parent: Option.none(),
    archive,
    manifestSha256: Option.none(),
    capturedMachineId: Option.some(machineId),
    capturedAt: Option.some(now),
    capturedSequence: Option.none(),
  };

  store.openMachine({ machineId, now });
  store.readyMachine({ machineId, now });
  store.commitWorkspace({ ...snapshot, shouldClearRecovery: false });

  const bucket: R2Bucket = {
    put: async (key) => {
      await beforePut();
      objects.add(key);

      return fixtureObject({ key });
    },
    list: async ({ prefix, limit } = {}) => {
      const matching = [...objects].filter((key) => key.startsWith(prefix ?? ''));
      const keys = matching.slice(0, limit);
      const page = { objects: keys.map((key) => fixtureObject({ key })), delimitedPrefixes: [] };

      if (matching.length > keys.length) {
        return { ...page, truncated: true, cursor: 'fixture-next-page' };
      }

      return { ...page, truncated: false };
    },
    delete: async (keys) => {
      if (typeof keys === 'string') {
        objects.delete(keys);

        return;
      }

      for (const key of keys) {
        objects.delete(key);
      }
    },
    head: async () => {
      throw new Error('retirement does not inspect R2 objects');
    },
    get: async () => {
      throw new Error('retirement does not read R2 objects');
    },
    createMultipartUpload: async () => {
      throw new Error('retirement does not create R2 uploads');
    },
    resumeMultipartUpload: () => {
      throw new Error('retirement does not resume R2 uploads');
    },
  };

  const provider: MachineProvider = {
    startupTimeout: () => Duration.seconds(1),
    start: async () => {
      throw new Error('retirement does not start a machine');
    },
    connect: async () => Option.none(),
    restoredWorkspace: async () => false,
    snapshotReport: async () => Option.none(),
    isAbsent: async () => false,
    stop: async (input) => {
      assert.equal(input.machineId, machineId);
      assert.equal(Option.isNone(input.checkpoint), true);
    },
  };

  const workspace: WorkspaceFiles = { bucket, owner: 'retirement' };
  const input = { store, provider, workspace, providerName: 'container', request };

  function checkpoint({ purpose }: { readonly purpose: FileCheckpointPurpose }): void {
    store.saveCheckpoint({
      generation,
      parent: Option.some(previous),
      machineId,
      startedAt: now,
      archive: Option.some(archive),
      part: archive.parts,
      capturedSequence: Option.none(),
      isAborting: false,
      purpose,
    });
  }

  return { ...input, checkpoint, objects, close: database.close };
}

void test(
  'explicit retirement fences a delayed automatic manifest before deleting its home',
  { timeout: 5000 },
  async () => {
    const held = Deferred.makeUnsafe<void>();
    const started = Deferred.makeUnsafe<boolean>();

    const fixture = retirementFixture({
      beforePut: async () => {
        await Effect.runPromise(Deferred.succeed(started, true));
        await Effect.runPromise(Deferred.await(held));
      },
    });

    fixture.checkpoint({ purpose: FileCheckpointPurpose.cases.Automatic.make({ operationId: checkpointId }) });

    const checkpoint = Option.getOrThrow(fixture.store.workspace().checkpoint);

    const publish: () => Promise<Result.Result<void, unknown>> = async () => {
      const promise = commitCheckpoint({ ...fixture, checkpoint, archive });
      const result = await capturePromise({ promise });

      await Effect.runPromise(Deferred.succeed(started, false));

      return result;
    };

    const publishing = publish();

    try {
      assert.equal(await Effect.runPromise(Deferred.await(started)), true);

      const now = DateTime.nowUnsafe();
      const timeout = Duration.seconds(1);

      fixture.store.claimExecution({ request: { executionId: terminalId, command: 'saved effect', timeout }, now });
      fixture.store.dispatchExecution({ executionId: terminalId, machineId, now });
      fixture.store.settleExecution({
        executionId: terminalId,
        machineId,
        now,
        receipt: {
          state: ReceiptStatus.Exited,
          exitCode: 0,
          duration: Duration.millis(1),
          output: { text: 'saved result', omittedBytes: Bytes.make(0) },
        },
      });

      const terminal = fixture.store.execution({ executionId: terminalId });

      fixture.store.claimExecution({
        request: { executionId: dispatchedId, command: 'external effect', timeout },
        now,
      });
      fixture.store.dispatchExecution({ executionId: dispatchedId, machineId, now });

      const admitted = await managePortable(fixture);

      assert.equal(admitted.phase, SandboxPhase.Retire);
      assert.equal(Option.getOrThrow(admitted.environment.checkpoint).generation, generation);
      assert.equal(Option.getOrThrow(admitted.environment.committedGeneration), previous);

      await Effect.runPromise(Deferred.succeed(held, undefined));
      Result.getOrThrow(await publishing);

      assert.equal(Option.getOrThrow(fixture.store.workspace().head).generation, previous);

      await managePortable(fixture);

      const report = await managePortable(fixture);

      assert.equal(report.phase, SandboxPhase.Done);
      assert.equal(report.status, 'empty');
      assert.equal(Option.isNone(fixture.store.workspace().head), true);
      assert.equal(Option.isNone(fixture.store.workspace().retired), true);
      assert.equal(fixture.objects.size, 0);
      assert.deepEqual(fixture.store.execution({ executionId: terminalId }), terminal);
      assert.equal(
        Option.getOrThrow(fixture.store.execution({ executionId: dispatchedId })).status,
        ExecutionStatus.Uncertain,
      );

      const nextMachineId = MachineId.make('30264fd4-e833-42cd-8da1-f1e354f34b44');

      fixture.store.openMachine({ machineId: nextMachineId, now });
      fixture.store.readyMachine({ machineId: nextMachineId, now });
      fixture.store.loseMachine({ machineId: nextMachineId, now });

      const afterLoss = await managePortable({
        ...fixture,
        request: { action: SandboxAction.Show, operationId: Option.none() },
      });

      assert.equal(afterLoss.status, 'recovery_required');
    } finally {
      await Effect.runPromise(Deferred.succeed(held, undefined));
      await Promise.allSettled([publishing]);
      fixture.close();
    }
  },
);

void test(
  'canceling before retirement resumes the same automatic checkpoint on the live machine',
  { timeout: 5000 },
  async () => {
    const fixture = retirementFixture();

    try {
      fixture.checkpoint({ purpose: FileCheckpointPurpose.cases.Automatic.make({ operationId: checkpointId }) });

      const original = Option.getOrThrow(fixture.store.workspace().checkpoint);

      await managePortable(fixture);

      const cancelled = await managePortable({
        ...fixture,
        request: { ...fixture.request, action: SandboxAction.Cancel },
      });

      assert.equal(Option.getOrThrow(cancelled.environment.committedGeneration), previous);
      assert.equal(Option.getOrThrow(cancelled.sandboxId).toString(), machineId.toString());
      assert.equal(Option.getOrThrow(cancelled.action), SandboxAction.Cancel);

      const checkpoint = Option.getOrThrow(fixture.store.workspace().checkpoint);

      assert.equal(checkpoint.lease, original.lease);

      await commitCheckpoint({ ...fixture, checkpoint, archive });

      assert.equal(Option.getOrThrow(fixture.store.workspace().head).generation, generation);
    } finally {
      fixture.close();
    }
  },
);

const required = [
  {
    name: 'Drain checkpoint',
    prepare: ({ fixture }: { readonly fixture: ReturnType<typeof retirementFixture> }) => {
      fixture.checkpoint({ purpose: FileCheckpointPurpose.cases.Drain.make({ operationId: checkpointId, machineId }) });
    },
  },
  {
    name: 'Activation checkpoint',
    prepare: ({ fixture }: { readonly fixture: ReturnType<typeof retirementFixture> }) => {
      fixture.checkpoint({ purpose: FileCheckpointPurpose.cases.Activation.make({ operationId: checkpointId }) });
    },
  },
  {
    name: 'recovery fence',
    prepare: ({ fixture }: { readonly fixture: ReturnType<typeof retirementFixture> }) => {
      fixture.store.recoverWorkspace({ machineId, generation, reason: 'fixture recovery is required' });
    },
  },
] as const;

for (const barrier of required) {
  void test(`retirement preserves a required ${barrier.name} and its committed home`, { timeout: 5000 }, async () => {
    const fixture = retirementFixture();

    try {
      barrier.prepare({ fixture });

      const before = fixture.store.workspace();

      await assert.rejects(managePortable(fixture), { _tag: 'PortableMaintenanceRefused' });
      assert.deepEqual(fixture.store.workspace(), before);
      assert.equal(Option.isNone(fixture.store.portableMaintenance()), true);
    } finally {
      fixture.close();
    }
  });
}
