import { HttpMethod, HttpStatusCode, MachineId, RecordId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import {
  guestWorkspacePath,
  SandboxRecoveryAction,
  SandboxStopOrigin,
  SandboxStopPhase,
  WorkspaceStep,
} from '@mechane/sandbox-wire';
import { DateTime, Duration, Option } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failCheckpoint } from '../src/checkpoints/fail-checkpoint.ts';
import { readyInteractiveMachine } from '../src/machines/ready-interactive-machine.ts';
import type { GuestConnection, GuestTransport, MachineProvider, WorkspaceFiles } from '../src/types.ts';
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

function idleStopFixture(transport?: GuestTransport) {
  const { store, close } = sqliteStore();
  const now = DateTime.nowUnsafe();
  const machineId = MACHINE;
  const generation = GENERATION;
  const part = Option.none();
  const path = guestWorkspacePath({ machineId, generation, step: WorkspaceStep.Release, part });
  const observed = { isReleaseAcknowledged: false, stoppedGeneration: Option.none<RecordId>() };

  const guest: GuestConnection = {
    fetch:
      transport?.fetch ??
      (async (request) => {
        assert.equal(request.path, path);
        assert.equal(request.init.method, HttpMethod.Delete);

        if (observed.isReleaseAcknowledged) {
          return new Response(null, { status: HttpStatusCode.Ok });
        }

        return new Response(null, { status: HttpStatusCode.NoContent });
      }),
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

function failedIdleStopFixture() {
  const fixture = idleStopFixture();
  const checkpoint = Option.getOrThrow(fixture.store.workspace().checkpoint);

  failCheckpoint({ ...fixture, checkpoint, cause: 'archive exceeds the limit', elapsed: Duration.seconds(1) });

  return fixture;
}

for (const origin of [SandboxStopOrigin.Idle, SandboxStopOrigin.Explicit]) {
  void test(`foreground admission after a failed ${origin} stop before capture`, async () => {
    const fixture = idleStopFixture();
    const { store, receipt, close, machineId } = fixture;

    try {
      store.retireWorkspace({ generation: GENERATION });
      store.saveSandboxStop({
        ...receipt,
        origin,
        phase: SandboxStopPhase.Failed,
        generation: Option.some(GENERATION),
        recoveryAction: SandboxRecoveryAction.RepairWorkspace,
      });

      assert.ok(Option.isNone(await readyInteractiveMachine(fixture)));

      fixture.observed.isReleaseAcknowledged = true;

      const ready = await readyInteractiveMachine(fixture);

      if (origin === SandboxStopOrigin.Explicit) {
        assert.ok(Option.isNone(ready));
        assert.ok(Option.isSome(store.machineDrain({ machineId })));
      } else {
        assert.equal(Option.getOrThrow(ready).id, machineId);
        assert.equal(Option.getOrThrow(store.latestSandboxStop()).phase, SandboxStopPhase.Canceled);
      }
    } finally {
      close();
    }
  });
}

void test('an idle stop can reopen the original home after an older runtime lost an automatic capture receipt', async (context) => {
  const generation = RecordId.make('5393f2ba-f676-47ef-91e3-b45da9a2be86');

  const release = guestWorkspacePath({
    machineId: MACHINE,
    generation,
    step: WorkspaceStep.Release,
    part: Option.none(),
  });

  const state = { isHeld: true };

  const fixture = idleStopFixture({
    fetch: async ({ path }) => {
      if (path === release) {
        state.isHeld = false;
      }

      if (state.isHeld) {
        return new Response('another workspace generation owns the guest fence', {
          status: HttpStatusCode.Unavailable,
        });
      }

      return new Response();
    },
  });

  context.after(fixture.close);

  const { store, receipt } = fixture;

  store.retireWorkspace({ generation: GENERATION });

  const now = DateTime.nowUnsafe();

  store.commitWorkspace({
    generation: GENERATION,
    archive: ARCHIVE,
    parent: Option.none(),
    manifestSha256: Option.none(),
    capturedAt: Option.some(now),
    capturedMachineId: Option.some(MACHINE),
    capturedSequence: Option.none(),
    shouldClearRecovery: false,
  });

  const metadata = JSON.stringify({
    operationId: generation,
    generation,
    path: null,
    cursor: 0,
    phase: 'archive',
    elapsedMs: 203,
    stepElapsedMs: 203,
  });

  const error = Option.some(
    `workspace transfer ${metadata}: Error: Durable Object reset because its code was updated.`,
  );

  store.scheduleAutomaticCheckpoint({ at: now, error });
  store.saveSandboxStop({
    ...receipt,
    origin: SandboxStopOrigin.Idle,
    phase: SandboxStopPhase.Failed,
    generation: Option.some(GENERATION),
    recoveryAction: SandboxRecoveryAction.RepairWorkspace,
  });

  const ready = await readyInteractiveMachine(fixture);

  assert.equal(Option.getOrThrow(ready).id, MACHINE);
  assert.equal(state.isHeld, false);
  assert.equal(Option.getOrThrow(store.workspace().head).generation, GENERATION);
  assert.equal(Option.getOrThrow(store.latestSandboxStop()).phase, SandboxStopPhase.Canceled);
});

void test('a failed idle save resumes the original guest only after it releases its files', async () => {
  const fixture = failedIdleStopFixture();
  const { store, observed, close, machineId } = fixture;

  try {
    const recovery = store.workspace().recovery;

    assert.ok(Option.isSome(recovery));

    const waiting = await readyInteractiveMachine(fixture);
    const failed = Option.getOrThrow(store.latestSandboxStop());

    assert.ok(Option.isNone(waiting));
    assert.equal(failed.phase, SandboxStopPhase.Failed);
    assert.deepEqual(store.workspace().recovery, recovery);

    observed.isReleaseAcknowledged = true;

    const ready = await readyInteractiveMachine(fixture);

    assert.equal(Option.getOrThrow(ready).id, machineId);
    assert.ok(Option.isNone(store.workspace().recovery));
    assert.ok(Option.isNone(store.workspace().head), 'Releasing a failed archive cannot create a checkpoint');
    assert.equal(Option.getOrThrow(store.liveMachine()).id, machineId);
    assert.deepEqual(Option.getOrThrow(store.latestSandboxStop()), failed);
    assert.equal(Option.getOrThrow(store.workspace().checkpointError), recovery.value.reason);
  } finally {
    close();
  }
});

void test('an explicit stop during guest release keeps ownership of the unsaved home', async () => {
  const fixture = failedIdleStopFixture();
  const { store, provider, machineId, close } = fixture;

  try {
    const recovery = store.workspace().recovery;
    const guest = Option.getOrThrow(await provider.connect({ machineId }));

    const promoting: GuestConnection = {
      ...guest,
      fetch: async (request) => {
        requestSandboxStop({ store, origin: SandboxStopOrigin.Explicit });

        fixture.observed.isReleaseAcknowledged = true;

        return await guest.fetch(request);
      },
    };

    const ready = await readyInteractiveMachine({
      ...fixture,
      provider: { ...provider, connect: async () => Option.some(promoting) },
    });

    assert.ok(Option.isNone(ready));
    assert.deepEqual(store.workspace().recovery, recovery);
    assert.equal(Option.getOrThrow(store.latestSandboxStop()).origin, SandboxStopOrigin.Explicit);
  } finally {
    close();
  }
});

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
