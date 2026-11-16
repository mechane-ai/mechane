import { HttpMethod, HttpStatusCode, MachineId, RecordId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { guestWorkspacePath, SandboxStopOrigin, SandboxStopPhase, WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Duration, Option } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GuestConnection, MachineProvider, WorkspaceFiles } from '../src/types.ts';
import { advanceSandboxStop } from '../src/workspace/advance-sandbox-stop.ts';
import { requestSandboxStop } from '../src/workspace/request-sandbox-stop.ts';
import { sqliteStore } from './store/sqlite-store.ts';

const MACHINE = MachineId.make('1cb42442-41ee-490f-b5a3-be0645ca2b27');
const GENERATION = RecordId.make('732040d3-747e-43aa-8d0e-0c38f90b2170');
const EXECUTION = '3126a3b3-217b-4d9f-9c53-8f6ea5781a92';
const ARCHIVE = { bytes: 1, parts: 1, sha256: 'a'.repeat(64) } as const;

function unusedBucket(): R2Bucket {
  function unexpected(): never {
    return assert.fail('The fixture supplies committed checkpoint evidence');
  }

  return {
    head: unexpected,
    get: unexpected,
    put: unexpected,
    list: unexpected,
    delete: unexpected,
    createMultipartUpload: unexpected,
    resumeMultipartUpload: unexpected,
  };
}

function idleStopFixture() {
  const { store, close } = sqliteStore();
  const now = DateTime.nowUnsafe();
  const machineId = MACHINE;
  const generation = GENERATION;
  const part = Option.none();
  const path = guestWorkspacePath({ machineId, generation, step: WorkspaceStep.Release, part });
  const observed = { isReleaseAcknowledged: false, stoppedGeneration: Option.none<RecordId>() };

  const guest: GuestConnection = {
    fetch: async (request) => {
      assert.equal(request.path, path);
      assert.equal(request.init.method, HttpMethod.Delete);

      if (observed.isReleaseAcknowledged) {
        return new Response(null, { status: HttpStatusCode.Ok });
      }

      return new Response(null, { status: HttpStatusCode.NoContent });
    },
    startup: async () => Option.none(),
    health: async () => true,
    execute: async () => assert.fail('a stop cannot dispatch a pending command'),
  };

  const provider: MachineProvider = {
    startupTimeout: () => Duration.seconds(1),
    start: async () => assert.fail('a stop cannot start a machine'),
    stop: async (input) => {
      assert.equal(input.machineId, machineId);

      observed.stoppedGeneration = Option.map(input.checkpoint, (snapshot) => snapshot.generation);
    },
    connect: async () => Option.some(guest),
    isAbsent: async () => false,
    restoredWorkspace: async () => false,
    snapshotReport: async () => Option.none(),
  };

  store.openMachine({ machineId, now });
  store.readyMachine({ machineId, now });

  const receipt = requestSandboxStop({ store, origin: SandboxStopOrigin.Idle });
  const workspace: WorkspaceFiles = { bucket: unusedBucket(), owner: 'idle-stop' };
  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });

  store.claimFileCheckpoint({ purpose, now });
  store.saveCheckpoint({
    generation,
    parent: Option.none(),
    machineId,
    startedAt: now,
    archive: Option.some(ARCHIVE),
    part: ARCHIVE.parts,
    capturedSequence: Option.none(),
    isAborting: false,
    purpose,
  });

  const claimedAt = DateTime.nowUnsafe();

  store.claimExecution({
    request: { executionId: EXECUTION, command: 'printf ready', timeout: Duration.seconds(1) },
    now: claimedAt,
  });

  return { store, close, provider, workspace, machineId, receipt, observed };
}

function commitFixtureCheckpoint({ store }: { readonly store: SandboxStore }): RecordId {
  const active = store.workspace().checkpoint;
  const checkpoint = Option.getOrThrow(active);
  const { generation, parent, machineId, startedAt, purpose, capturedSequence } = checkpoint;
  const result = FileCheckpointResult.cases.Committed.make({ generation });

  store.finishFileCheckpoint({ purpose, result });
  store.commitWorkspace({
    generation,
    parent,
    archive: ARCHIVE,
    manifestSha256: Option.none(),
    capturedAt: Option.some(startedAt),
    capturedMachineId: Option.some(machineId),
    capturedSequence,
    shouldClearRecovery: false,
  });

  return generation;
}

void test(
  'an interrupted idle-stop cancellation releases only its committed drain on the same machine',
  { timeout: 5000 },
  async () => {
    const fixture = idleStopFixture();
    const { store, machineId, observed, close } = fixture;

    try {
      const active = await advanceSandboxStop(fixture);

      assert.equal(active.phase, SandboxStopPhase.Checkpointing);
      commitFixtureCheckpoint({ store });

      const canceling = await advanceSandboxStop(fixture);

      assert.equal(canceling.phase, SandboxStopPhase.Canceling);
      assert.ok(Option.isSome(store.machineDrain({ machineId })), 'An unacknowledged release must hold admission');

      store.cancelPendingExecution({ executionId: EXECUTION });

      observed.isReleaseAcknowledged = true;

      const canceled = await advanceSandboxStop(fixture);

      assert.equal(canceled.phase, SandboxStopPhase.Canceled);
      assert.ok(Option.isNone(store.machineDrain({ machineId })));
      assert.equal(Option.getOrThrow(store.liveMachine()).id, machineId);
      assert.equal(Option.getOrThrow(store.workspace().head).generation, GENERATION);
      assert.ok(DateTime.isGreaterThan(Option.getOrThrow(store.sandboxIdleAt()), canceled.updatedAt));
    } finally {
      close();
    }
  },
);

void test(
  'one explicit stop during idle release completes a fresh drain under the original stop receipt',
  { timeout: 5000 },
  async () => {
    const fixture = idleStopFixture();
    const { store, machineId, receipt, observed, close } = fixture;

    try {
      const priorGeneration = commitFixtureCheckpoint({ store });
      const canceling = await advanceSandboxStop(fixture);

      assert.equal(canceling.phase, SandboxStopPhase.Canceling);

      const joined = requestSandboxStop({ store, origin: SandboxStopOrigin.Explicit });

      assert.equal(joined.operationId, receipt.operationId);
      assert.equal(joined.origin, SandboxStopOrigin.Explicit);

      observed.isReleaseAcknowledged = true;

      await advanceSandboxStop(fixture);

      const freshDrain = Option.getOrThrow(store.machineDrain({ machineId }));

      assert.notEqual(freshDrain.operationId, receipt.operationId);

      const saving = await advanceSandboxStop(fixture);

      assert.equal(saving.phase, SandboxStopPhase.Checkpointing);
      assert.ok(Option.isSome(store.liveMachine()));
      assert.ok(Option.isNone(observed.stoppedGeneration));

      const freshGeneration = commitFixtureCheckpoint({ store });
      const stopped = await advanceSandboxStop(fixture);

      assert.notEqual(freshGeneration, priorGeneration);
      assert.equal(stopped.operationId, receipt.operationId);
      assert.equal(stopped.phase, SandboxStopPhase.Completed);
      assert.equal(Option.getOrThrow(observed.stoppedGeneration), freshGeneration);
    } finally {
      close();
    }
  },
);
