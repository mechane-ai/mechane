import { HttpHeader, HttpMethod, HttpStatusCode, MachineId, RecordId, SandboxOperationId } from '@mechane/records';
import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import {
  guestWorkspacePath,
  SANDBOX_ARCHIVE_PART_BYTES,
  WorkspaceRestoreSource,
  WorkspaceStep,
} from '@mechane/sandbox-wire';
import { DateTime, Duration, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { advanceCheckpoint } from '../src/checkpoints/advance-checkpoint.ts';
import { runRecoveryCheckpoint } from '../src/checkpoints/run-recovery-checkpoint.ts';
import { uploadCheckpointPart } from '../src/checkpoints/upload-checkpoint-part.ts';
import { WorkspaceTransferPhase } from '../src/errors.ts';
import type { GuestConnection, GuestTransport, MachineProvider } from '../src/types.ts';
import { advanceWorkspace } from '../src/workspace/advance-workspace.ts';
import { observeWorkspaceTransfer } from '../src/workspace/observe-workspace-transfer.ts';
import { activateSnapshot } from '../src/workspace/snapshots/activate-snapshot.ts';
import { workspacePartKey } from '../src/workspace/workspace-part-key.ts';
import { workspaceRequest } from '../src/workspace/workspace-request.ts';
import { sqliteStore } from './store/sqlite-store.ts';

const machineId = MachineId.make('149414e8-3722-41df-ad64-4a5f584225c3');
const generation = RecordId.make('46c5b3bd-1cab-4350-a020-6a393a8ac3c7');
const PART_INDEX = 7;
const PRIVATE_TEXT = 'fixture-private-command-output-and-credential';
const RAY = '0123456789abcdef-SJC';
const FAILURE_REASON = String(new Error(PRIVATE_TEXT));

const identity = { machineId, generation, step: WorkspaceStep.Part, part: Option.some(PART_INDEX) } as const;

const request = {
  ...identity,
  lease: Option.none<number>(),
  init: { method: HttpMethod.Put, body: PRIVATE_TEXT, headers: { [HttpHeader.Authorization]: PRIVATE_TEXT } },
} as const;

function guestConnection({ fetch }: GuestTransport): GuestConnection {
  return {
    fetch,
    health: async () => false,
    startup: async () => Option.none(),
    execute: async () => {
      throw new Error('The transfer fixture does not execute commands');
    },
  };
}

function recordedFailure({ lines }: { readonly lines: ReadonlyArray<unknown> }): Readonly<Record<string, unknown>> {
  assert.equal(lines.length, 1);

  const line = Schema.decodeUnknownSync(Schema.String)(lines[0]);
  const record = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(JSON.parse(line));
  const { elapsedMs, ...metadata } = record;

  assert.equal(typeof elapsedMs, 'number');

  return metadata;
}

async function transferResponse({ response }: { readonly response: Response }): Promise<Response> {
  const guest = guestConnection({ fetch: async () => response });

  return await workspaceRequest({ ...request, guest });
}

async function rejectedFetch(): Promise<Response> {
  const guest = guestConnection({
    fetch: async () => {
      throw new Error(PRIVATE_TEXT);
    },
  });

  return await workspaceRequest({ ...request, guest });
}

const metadata = {
  event: 'sandbox.workspace_transfer_failed',
  machineId,
  generation,
  step: WorkspaceStep.Part,
  part: PART_INDEX,
} as const;

const cases = [
  {
    name: 'a failed transfer fetch reports its boundary without private transport text',
    run: rejectedFetch,
    failure: { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON },
    diagnostic: { phase: 'fetch' },
  },
  {
    name: 'a rejected transfer reports its status and validated ray without its headers or body',
    run: async () => {
      const response = new Response(PRIVATE_TEXT, {
        status: HttpStatusCode.Unavailable,
        headers: {
          [HttpHeader.CloudflareRay]: RAY,
          [HttpHeader.Authorization]: PRIVATE_TEXT,
          [HttpHeader.Location]: PRIVATE_TEXT,
        },
      });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: PRIVATE_TEXT },
    diagnostic: { phase: 'http', status: HttpStatusCode.Unavailable, cloudflareRay: RAY },
  },
  {
    name: 'a malformed correlation header is omitted from transfer diagnostics',
    run: async () => {
      const response = new Response(PRIVATE_TEXT, {
        status: HttpStatusCode.Unavailable,
        headers: { [HttpHeader.CloudflareRay]: `${RAY} ${PRIVATE_TEXT}` },
      });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: PRIVATE_TEXT },
    diagnostic: { phase: 'http', status: HttpStatusCode.Unavailable },
  },
  {
    name: 'a failed rejection body reports body work rather than an HTTP rejection',
    run: async () => {
      const body = new ReadableStream({ start: (controller) => controller.error(new Error(PRIVATE_TEXT)) });
      const response = new Response(body, { status: HttpStatusCode.Unavailable });

      return await transferResponse({ response });
    },
    failure: { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON },
    diagnostic: { phase: 'body', status: HttpStatusCode.Unavailable },
  },
  {
    name: 'metadata decode failures report the response without private schema input',
    run: async () => {
      const response = new Response(PRIVATE_TEXT);
      const codec = Schema.fromJsonString(Schema.Int);

      return await observeWorkspaceTransfer({
        ...identity,
        phase: WorkspaceTransferPhase.ResponseBody,
        failurePhase: 'decode',
        response: Option.some(response),
        run: async () => Schema.decodeUnknownSync(codec)(await response.text()),
      });
    },
    failure: { _tag: 'WorkspaceTransferFailed' },
    diagnostic: { phase: 'decode', status: HttpStatusCode.Ok },
  },
] as const;

for (const fixture of cases) {
  void test(fixture.name, { timeout: 5000 }, async (context) => {
    const lines: Array<unknown> = [];

    context.mock.method(console, 'error', (line: unknown) => lines.push(line));

    await assert.rejects(fixture.run(), fixture.failure);

    assert.deepEqual(recordedFailure({ lines }), { ...metadata, ...fixture.diagnostic });
  });
}

void test('a diagnostic sink failure cannot replace the transfer failure', { timeout: 5000 }, async (context) => {
  context.mock.method(console, 'error', () => {
    throw new Error('fixture diagnostic sink is unavailable');
  });

  await assert.rejects(rejectedFetch(), { _tag: 'WorkspaceTransferFailed', reason: FAILURE_REASON });
});

const CHECKPOINT_CONTENT = 'checkpoint fixture data';
const CHECKPOINT_OWNER = 'required-checkpoint';
const RECOVERY_UPLOADED_PARTS = 1000;
const RECOVERY_ELAPSED = Duration.minutes(8);
const checkpointOperation = SandboxOperationId.make('d0512f6f-c8f3-4d93-9c8f-617fcd550833');
const drain = FileCheckpointPurpose.cases.Drain.make({ operationId: checkpointOperation, machineId });

function unexpectedCheckpointOperation(): never {
  throw new Error('unexpected checkpoint fixture operation');
}

type CheckpointFixtureInput = GuestTransport & {
  readonly purpose?: FileCheckpointPurpose;
  readonly uploadedParts?: number;
};

function checkpointPartFixture({ fetch, purpose = drain, uploadedParts = 0 }: CheckpointFixtureInput) {
  const { store, close } = sqliteStore();
  const now = DateTime.nowUnsafe();
  const contents = new TextEncoder().encode(CHECKPOINT_CONTENT);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const bytes = SANDBOX_ARCHIVE_PART_BYTES * uploadedParts + contents.byteLength;
  const archive = { bytes, parts: uploadedParts + 1, sha256 };
  const part = uploadedParts;
  const parent = Option.none();
  const capturedSequence = Option.none();

  store.openMachine({ machineId, now });
  store.readyMachine({ machineId, now });

  if (FileCheckpointPurpose.guards.Recovery(purpose)) {
    store.recoverWorkspace({ machineId, generation: purpose.recoveryGeneration, reason: 'previous save expired' });
  }

  store.claimFileCheckpoint({ purpose, now });
  store.saveCheckpoint({
    generation,
    parent,
    machineId,
    startedAt: now,
    archive: Option.some(archive),
    part,
    capturedSequence,
    isAborting: false,
    purpose,
  });

  const objects = new Map<string, Uint8Array>();

  const bucket: R2Bucket = {
    put: async (key, value) => {
      assert.ok(value instanceof Uint8Array);
      objects.set(key, value);

      return {
        key,
        size: value.byteLength,
        storageClass: 'Standard',
        uploaded: new Date(0),
        etag: 'fixture',
        httpEtag: '"fixture"',
        version: 'fixture',
        checksums: { toJSON: () => ({}) },
        writeHttpMetadata: () => undefined,
      };
    },
    head: async () => null,
    get: unexpectedCheckpointOperation,
    list: unexpectedCheckpointOperation,
    delete: unexpectedCheckpointOperation,
    createMultipartUpload: unexpectedCheckpointOperation,
    resumeMultipartUpload: unexpectedCheckpointOperation,
  };

  const workspace = { bucket, owner: CHECKPOINT_OWNER };
  const checkpoint = Option.getOrThrow(store.workspace().checkpoint);
  const guest = guestConnection({ fetch });

  return { store, close, workspace, checkpoint, guest, part, archive, contents, objects };
}

function checkpointProvider({ guest }: { readonly guest: GuestConnection }): MachineProvider {
  return {
    startupTimeout: () => Duration.zero,
    start: unexpectedCheckpointOperation,
    connect: async (input) => {
      assert.equal(input.machineId, machineId);

      return Option.some(guest);
    },
    isAbsent: async () => false,
    stop: unexpectedCheckpointOperation,
    restoredWorkspace: async () => false,
    snapshotReport: async () => Option.none(),
  };
}

function interruptFirstPartRead({ mock }: TestContext, error: Error) {
  const fetch = mock.fn<GuestTransport['fetch']>(async () => new Response(CHECKPOINT_CONTENT));

  fetch.mock.mockImplementationOnce(async () => {
    throw error;
  });

  return fetch;
}

void test('a required checkpoint survives a lost part response', { timeout: 5000 }, async (context) => {
  const fetch = interruptFirstPartRead(context, new Error('guest connection closed before headers'));

  const fixture = checkpointPartFixture({ fetch });

  context.after(fixture.close);

  await uploadCheckpointPart(fixture);

  const part = Option.some(fixture.part);
  const step = WorkspaceStep.Part;
  const path = guestWorkspacePath({ machineId, generation, step, part });
  const expectedRead = { path, method: HttpMethod.Get };
  const reads = fetch.mock.calls.map(({ arguments: [input] }) => ({ path: input.path, method: input.init.method }));
  const key = workspacePartKey({ owner: CHECKPOINT_OWNER, generation, part });

  assert.deepEqual(reads, [expectedRead, expectedRead]);
  assert.deepEqual(fixture.objects.get(key), fixture.contents);
});

void test('a lost restore acknowledgement can poll the same generation again', async (context) => {
  const fetch = context.mock.fn<GuestTransport['fetch']>(async () => new Response());

  fetch.mock.mockImplementationOnce(async () => {
    throw new Error('guest closed the connection');
  });

  const { store, close } = sqliteStore();

  context.after(close);

  const sha256 = createHash('sha256').update('a').digest('hex');
  const archive = { bytes: 1, parts: 1, sha256 };

  const restoration = {
    machineId,
    generation,
    part: archive.parts,
    startedAt: DateTime.nowUnsafe(),
    source: WorkspaceRestoreSource.Archive,
  };

  store.saveRestoration(restoration);

  const input = { store, guest: guestConnection({ fetch }), restoration, archive };

  assert.equal(await activateSnapshot(input), false);
  assert.equal(await activateSnapshot(input), true);

  const paths = fetch.mock.calls.map(({ arguments: [sent] }) => sent.path);
  const path = guestWorkspacePath({ machineId, generation, step: WorkspaceStep.Restore, part: Option.none() });

  assert.deepEqual(paths, [path, path]);
});

void test('a checkpoint part HTTP rejection is terminal', { timeout: 5000 }, async (context) => {
  const reason = 'TimeoutError: fixture refused the checkpoint part';

  const fetch = context.mock.fn<GuestTransport['fetch']>(
    async () => new Response(reason, { status: HttpStatusCode.Unavailable }),
  );

  const fixture = checkpointPartFixture({ fetch });

  context.after(fixture.close);

  await assert.rejects(uploadCheckpointPart(fixture), { _tag: 'WorkspaceTransferFailed', reason });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(fixture.objects.size, 0);
});

void test('same-guest recovery can retry a part and publish after the ordinary checkpoint deadline', async (context) => {
  const now = Date.now();

  context.mock.timers.enable({ apis: ['Date'], now });

  const purpose = FileCheckpointPurpose.cases.Recovery.make({
    operationId: checkpointOperation,
    machineId,
    recoveryGeneration: RecordId.make('8197140a-1858-4883-a807-b66447da9094'),
    committedGeneration: Option.none(),
  });

  const fetch = interruptFirstPartRead(context, new DOMException('checkpoint part response timed out', 'TimeoutError'));

  const fixture = checkpointPartFixture({ fetch, purpose, uploadedParts: RECOVERY_UPLOADED_PARTS });

  context.after(fixture.close);

  const provider = checkpointProvider({ guest: fixture.guest });

  context.mock.timers.setTime(now + Duration.toMillis(RECOVERY_ELAPSED));

  const input = { ...fixture, provider, purpose };
  const pending = await runRecoveryCheckpoint(input);

  assert.equal(pending._tag, 'Pending');

  await advanceCheckpoint(input);

  assert.deepEqual(Option.getOrThrow(fixture.store.fileCheckpointResult({ purpose })), {
    _tag: 'Committed',
    generation,
  });
  assert.equal(Option.isNone(fixture.store.workspace().recovery), true);
});

void test('after an interrupted automatic transfer the guest must acknowledge its original lease before retirement', async (context) => {
  const purpose = FileCheckpointPurpose.cases.Automatic.make({ operationId: SandboxOperationId.make(generation) });
  const release = guestWorkspacePath({ machineId, generation, step: WorkspaceStep.Release, part: Option.none() });
  const state = { isReleaseAccepted: false };

  const fetch: GuestTransport['fetch'] = async ({ path, init }) => {
    if (path !== release || init.method !== HttpMethod.Delete) {
      throw new Error('the transfer was interrupted');
    }

    assert.equal(new Headers(init.headers).get(HttpHeader.MechaneCheckpointLease), String(fixture.checkpoint.lease));

    if (state.isReleaseAccepted) {
      return new Response();
    }

    return new Response(null, { status: HttpStatusCode.NoContent });
  };

  const fixture = checkpointPartFixture({ fetch, purpose });

  context.after(fixture.close);

  const provider = checkpointProvider({ guest: fixture.guest });
  const input = { ...fixture, provider };

  await advanceCheckpoint(input);
  await advanceWorkspace({ ...input, shouldAdmitCommand: true });

  const held = Option.getOrThrow(fixture.store.workspace().checkpoint);

  assert.equal(held.generation, generation);
  assert.equal(held.isAborting, true);
  assert.equal(Option.isNone(fixture.store.workspace().retired), true);

  state.isReleaseAccepted = true;

  await advanceCheckpoint({ ...input, checkpoint: held });
  assert.equal(Option.isNone(fixture.store.workspace().checkpoint), true);
  assert.equal(Option.getOrThrow(fixture.store.workspace().retired), generation);
  assert.equal(Option.isSome(fixture.store.workspace().checkpointError), true);
  assert.equal(Option.isNone(fixture.store.workspace().head), true);
});
