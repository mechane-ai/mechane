import { SandboxReport, TurnStatus } from '@mechane/protocol';
import { BYTES_PER_MEBIBYTE, HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import {
  ExecutionId,
  sandboxExecutionPath,
  SandboxExecutionResult,
  SandboxRecoveryCheckpointResult,
  sandboxRestorePath,
  SandboxRestoreRefusalReason,
  SandboxRestoreRequest,
  SandboxRestoreResult,
  SandboxServiceIdentity,
  sandboxStopPath,
  SandboxStopPhase,
  sandboxStopReadPath,
  SandboxStopReceipt,
  sandboxWorkspacePath,
} from '@mechane/sandbox-wire';
import {
  checkpointSandbox,
  readModelToolResult,
  readSandboxCompletion,
  requireFixtures,
  runBash,
  runCli,
  sendNotification,
  startCommandGate,
  upgradeSandbox,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const MULTIPART_FILE_BYTES = 33 * BYTES_PER_MEBIBYTE;
const REQUEST_DEADLINE_MS = 15_000;
const UNSAVED_WRITER_REQUESTS = 2;

const StartedProcess = Schema.Struct({
  status: Schema.Literal('running'),
  processId: Schema.String,
  machineId: Schema.String,
});

const STOP_TERMINAL_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Failed,
]);

type FilesInput = MechContext & { readonly directory: string };
type RestoreReceipt = { readonly request: SandboxRestoreRequest; readonly result: SandboxRestoreResult };

export async function checkpointedFilesSurviveMachineLoss({
  stack,
  account,
  mechId,
  directory,
}: FilesInput): Promise<void> {
  const input = { stack, account, mechId };
  const { model } = requireFixtures(stack);
  const sandbox = requireSandbox(input);
  const cacheMarker = `cache-${randomUUID()}`;
  const initializationCommand = createCheckpointFilesCommand({ directory, cacheMarker });
  const saved = await runBash({ ...input, command: initializationCommand });

  assert.equal(saved.receipt.status, 'completed');

  const digest = saved.result.output;

  assert.match(digest, /^[a-f0-9]{64}$/);

  const saveOperationId = randomUUID();

  const committed = await waitFor({
    name: 'the explicit portable-home checkpoint after command completion',
    read: () => checkpointSandbox({ ...input, operationId: saveOperationId }),
    accept: (result) => result._tag !== 'Pending',
  });

  assert.equal(committed._tag, 'Committed');

  await recoveryFenceRefusesPendingCommands({ ...input, directory });

  const restoreReceipt = await restoreLastCommittedFilesAfterMachineLoss({ ...input, directory });

  const savedReport = await readSandboxReport(input);

  assert.ok(Option.isSome(savedReport.environment.committedGeneration), 'The file barrier left no committed files');
  assert.ok(Option.isNone(savedReport.environment.checkpoint), 'The file barrier left an unfinished checkpoint');

  const marker = `lost-writer-${randomUUID()}`;
  const toolCallId = randomUUID();
  const gate = await startCommandGate({ stack });

  try {
    const command = [
      `curl --fail --silent '${gate.url}'`,
      `printf unsaved > '${directory}/unsaved'`,
      `curl --fail --silent '${gate.url}'`,
      'while :; do sleep 1; done',
    ].join('\n');

    model.configure({
      marker,
      replies: [
        { tools: [{ id: toolCallId, name: 'start_process', input: { command } }] },
        { isHeld: true, text: 'The managed writer remains active' },
      ],
    });

    const sent = await sendNotification({ ...input, text: marker });
    const started = Schema.decodeUnknownSync(StartedProcess)(await readModelToolResult({ model, marker, toolCallId }));
    const machines = await sandbox.readMachines();
    const otherMachines = machines.filter((machineId) => machineId !== started.machineId);

    try {
      await gate.waitForRequest({ count: 1 });
      gate.release();
      await gate.waitForRequest({ count: UNSAVED_WRITER_REQUESTS });
      await sandbox.loseMachine(started.machineId);
    } finally {
      model.release({ marker, index: 1 });
    }

    const writerTurn = await waitForTurn({ ...input, notificationId: sent.id });
    const checkpointOperationId = randomUUID();
    const checkpointInput = { ...input, operationId: checkpointOperationId };
    const afterLoss = await checkpointSandbox(checkpointInput);

    assert.equal(writerTurn.status, TurnStatus.Completed);
    assert.equal(afterLoss._tag, 'Failed');

    const afterLossReport = await readSandboxReport(input);

    assert.deepEqual(afterLossReport.environment.committedGeneration, savedReport.environment.committedGeneration);
    assert.deepEqual(await sandbox.readMachines(), otherMachines);

    const blocked = await runBash({ ...input, command: `printf forbidden > '${directory}/after-loss'` });
    const blockedReport = await readSandboxReport(input);

    assert.equal(blocked.receipt.status, 'unavailable', 'Fresh work bypassed the lost-machine file barrier');
    assert.deepEqual(await sandbox.readMachines(), otherMachines, 'Fresh work silently allocated after machine loss');
    assert.deepEqual(blockedReport.environment.committedGeneration, savedReport.environment.committedGeneration);

    await upgradeSandbox(input);

    const retainedFailure = await checkpointSandbox(checkpointInput);

    assert.deepEqual(retainedFailure, afterLoss, 'Recovery changed the original failed checkpoint receipt');

    const restored = await runBash({
      ...input,
      command: [
        `test ! -f '${directory}/unsaved'`,
        `test ! -f '${directory}/after-loss'`,
        `test ! -f "$MECHANE_CACHE_HOME/${cacheMarker}"`,
        `node -e 'const fs=require("node:fs"),crypto=require("node:crypto");process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync("${directory}/multipart")).digest("hex"))'`,
      ].join(' && '),
    });

    assert.equal(restored.turn.status, TurnStatus.Completed);
    assert.equal(restored.result.output, digest, 'Recovery lost committed files or retained a machine-local cache');

    await stoppedReceiptSurvivesReplacement(input);

    const afterReplacement = await runBash({
      ...input,
      command: `node -e 'const fs=require("node:fs"),crypto=require("node:crypto");process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync("${directory}/multipart")).digest("hex"))'`,
    });

    assert.equal(afterReplacement.result.output, digest);

    const beforeRetry = await readSandboxReport(input);
    const retainedRestore = await requestRestore({ ...input, request: restoreReceipt.request });
    const afterRetry = await readSandboxReport(input);

    assert.deepEqual(retainedRestore, restoreReceipt.result, 'Later maintenance replaced the original restore receipt');
    assert.deepEqual(afterRetry.environment.committedGeneration, beforeRetry.environment.committedGeneration);
    assert.deepEqual(
      afterRetry.sandboxId,
      beforeRetry.sandboxId,
      'Retrying a completed restore allocated another guest',
    );
    assert.equal(
      gate.readRequests().length,
      UNSAVED_WRITER_REQUESTS,
      'Machine loss restarted the writer on a replacement',
    );
  } catch (cause) {
    await stack.captureFailure('checkpointedFilesSurviveMachineLoss:before-gate-cleanup').catch(() => undefined);

    throw cause;
  } finally {
    gate.release();
    await gate.close();
  }
}

async function restoreLastCommittedFilesAfterMachineLoss(input: FilesInput): Promise<RestoreReceipt> {
  const unreadable = join(input.directory, 'restore-unreadable');
  const unsaved = join(input.directory, 'restore-unsaved');

  const written = await runBash({
    ...input,
    command: `mkdir '${unreadable}' && printf unsaved > '${unsaved}' && chmod 000 '${unreadable}'`,
  });

  assert.equal(written.receipt.status, 'completed');

  const original = await requestStopReceipt(input);

  const failed = await waitFor({
    name: 'the unreadable final drain to retain its failed Stop and recovery generation',
    read: () => readStopReceipt({ ...input, operationId: original.operationId }),
    accept: (receipt) => STOP_TERMINAL_PHASES.has(receipt.phase),
  });

  assert.equal(failed.phase, SandboxStopPhase.Failed);

  const before = await readSandboxReport(input);
  const recovery = Option.getOrThrow(before.environment.recovery);
  const committedGeneration = Option.getOrThrow(before.environment.committedGeneration);

  const request = Schema.decodeUnknownSync(Schema.toType(SandboxRestoreRequest))({
    operationId: randomUUID(),
    machineId: recovery.machineId,
    recoveryGeneration: recovery.generation,
    committedGeneration,
  });

  const wrongHead = Schema.decodeUnknownSync(Schema.toType(SandboxRestoreRequest))({
    ...request,
    committedGeneration: randomUUID(),
  });

  const changed = await requestRestore({ ...input, request: wrongHead });
  const active = await requestRestore({ ...input, request });

  assert.deepEqual(changed, { _tag: 'RestoreRefused', reason: SandboxRestoreRefusalReason.WorkspaceChanged });
  assert.deepEqual(active, { _tag: 'RestoreRefused', reason: SandboxRestoreRefusalReason.ProviderActive });

  const afterRefusal = await readSandboxReport(input);

  assert.deepEqual(afterRefusal.environment.recovery, before.environment.recovery);
  assert.deepEqual(afterRefusal.environment.committedGeneration, before.environment.committedGeneration);
  assert.deepEqual(afterRefusal.sandboxId, before.sandboxId);

  await requireSandbox(input).loseMachine(request.machineId);

  const admitted = await requestRestore({ ...input, request });
  const reused = await requestRestore({ ...input, request: wrongHead });

  assert.equal(admitted._tag, 'Pending');
  assert.deepEqual(reused, { _tag: 'RestoreRefused', reason: SandboxRestoreRefusalReason.OperationReused });

  const result = await runCli({
    ...input,
    args: [
      'sandbox',
      'restore',
      input.mechId,
      '--workspace',
      input.account.workspaceId,
      '--operation-id',
      request.operationId,
      '--machine-id',
      request.machineId,
      '--recovery-generation',
      request.recoveryGeneration,
      '--committed-generation',
      request.committedGeneration,
    ],
    schema: SandboxRestoreResult,
  });

  assert.equal(result._tag, 'Restored');

  const after = await readSandboxReport(input);

  const retainedStop = await readStopReceipt({ ...input, operationId: original.operationId });

  assert.ok(Option.isNone(after.environment.recovery));
  assert.notDeepEqual(after.sandboxId, before.sandboxId);
  assert.deepEqual(after.environment.committedGeneration, before.environment.committedGeneration);
  assert.deepEqual(retainedStop, failed, 'Restoring older files rewrote the failed final-drain receipt');

  const files = await runBash({
    ...input,
    command: `test ! -e '${unsaved}' && test ! -e '${unreadable}' && test -f '${input.directory}/multipart' && printf restored`,
  });

  assert.equal(files.result.output, 'restored', 'Restore did not activate exactly the last saved home');

  return { request, result };
}

async function requestStopReceipt(input: MechContext): Promise<SandboxStopReceipt> {
  const path = sandboxStopPath(sandboxIdentity(input));
  const result = await sandboxRequest({ ...input, path, method: HttpMethod.Post });

  return Schema.decodeUnknownSync(SandboxStopReceipt)(result);
}

type ReadStopInput = MechContext & Pick<SandboxStopReceipt, 'operationId'>;

async function readStopReceipt({ operationId, ...input }: ReadStopInput): Promise<SandboxStopReceipt> {
  const path = sandboxStopReadPath({ ...sandboxIdentity(input), operationId });
  const result = await sandboxRequest({ ...input, path, method: HttpMethod.Get });

  return Schema.decodeUnknownSync(SandboxStopReceipt)(result);
}

type RestoreRequestInput = MechContext & { readonly request: SandboxRestoreRequest };

async function requestRestore({ request, ...input }: RestoreRequestInput): Promise<SandboxRestoreResult> {
  const path = sandboxRestorePath(sandboxIdentity(input));
  const body = Schema.encodeSync(SandboxRestoreRequest)(request);
  const result = await sandboxRequest({ ...input, path, method: HttpMethod.Post, body });

  return Schema.decodeUnknownSync(SandboxRestoreResult)(result);
}

async function recoveryFenceRefusesPendingCommands(input: FilesInput): Promise<void> {
  const { model } = requireFixtures(input.stack);
  const gate = await startCommandGate({ stack: input.stack });
  const operationId = randomUUID();
  const marker = `repair-${operationId}`;
  const toolCallId = randomUUID();
  const directory = join(input.directory, 'unreadable');
  const identity = sandboxIdentity(input);
  const pendingId = randomUUID();
  const pendingExecutionId = ExecutionId.make(pendingId);
  const pendingPath = sandboxExecutionPath({ ...identity, executionId: pendingExecutionId });
  const pending = { command: 'printf must-not-run', timeoutMs: REQUEST_DEADLINE_MS, waitMs: 0, environment: null };

  const command = [
    'set -e',
    `mkdir '${directory}'`,
    `trap 'chmod 700 "${directory}"; rmdir "${directory}"' EXIT`,
    `chmod 000 '${directory}'`,
    `curl --fail --silent '${gate.url}'`,
  ].join('\n');

  model.configure({
    marker,
    replies: [
      { tools: [{ id: toolCallId, name: 'start_process', input: { command } }] },
      { text: 'The checkpoint fixture is waiting' },
    ],
  });

  try {
    const sent = await sendNotification({ ...input, text: marker });
    const started = Schema.decodeUnknownSync(StartedProcess)(await readModelToolResult({ model, marker, toolCallId }));

    await waitForTurn({ ...input, notificationId: sent.id });
    await gate.waitForRequest({ count: 1 });
    await sandboxRequest({ ...input, path: pendingPath, method: HttpMethod.Post, body: pending });

    const failed = await waitFor({
      name: 'the required checkpoint to retain its unreadable live directory for recovery',
      read: () => checkpointSandbox({ ...input, operationId }),
      accept: (result) => result._tag !== 'Pending',
    });

    assert.equal(failed._tag, 'Failed');

    const before = await readSandboxReport(input);
    const recovery = Option.getOrThrow(before.environment.recovery);
    const freshId = randomUUID();
    const freshExecutionId = ExecutionId.make(freshId);
    const freshPath = sandboxExecutionPath({ ...identity, executionId: freshExecutionId });
    const fresh = await sandboxRequest({ ...input, path: freshPath, method: HttpMethod.Post, body: pending });
    const existing = await sandboxRequest({ ...input, path: pendingPath, method: HttpMethod.Get });

    assert.equal(Schema.decodeUnknownSync(SandboxExecutionResult)(fresh)._tag, 'Unavailable');
    assert.equal(Schema.decodeUnknownSync(SandboxExecutionResult)(existing)._tag, 'Unavailable');

    const after = await readSandboxReport(input);

    assert.deepEqual(after.environment.recovery, before.environment.recovery);
    assert.deepEqual(after.environment.committedGeneration, before.environment.committedGeneration);

    model.configure({ marker: started.processId, replies: [{ text: 'The directory is readable again' }] });
    gate.release();

    await waitFor({
      name: 'the fixture process to restore the directory permissions',
      read: () => readSandboxCompletion({ ...input, executionId: started.processId }),
      accept: (receipt) => receipt !== null,
    });

    const path = recoveryCheckpointPath({ ...identity, operationId: randomUUID() });

    const body = {
      machineId: recovery.machineId,
      recoveryGeneration: recovery.generation,
      committedGeneration: Option.getOrNull(before.environment.committedGeneration),
    };

    const repaired = await waitFor({
      name: 'the recovery checkpoint to commit after refusing never-dispatched commands',
      read: async () =>
        Schema.decodeUnknownSync(SandboxRecoveryCheckpointResult)(
          await sandboxRequest({ ...input, path, method: HttpMethod.Post, body }),
        ),
      accept: (result) => result._tag !== 'Pending',
    });

    assert.equal(repaired._tag, 'Committed', 'A refused command kept its own file recovery busy');

    const retained = await sandboxRequest({ ...input, path: freshPath, method: HttpMethod.Post, body: pending });
    const repairedReport = await readSandboxReport(input);

    assert.equal(Schema.decodeUnknownSync(SandboxExecutionResult)(retained)._tag, 'Unavailable');
    assert.deepEqual(repairedReport.sandboxId, before.sandboxId);
  } finally {
    gate.release();
    await gate.close();
  }
}

type RecoveryCheckpointPathInput = SandboxServiceIdentity & { readonly operationId: string };

function recoveryCheckpointPath({ operationId, ...identity }: RecoveryCheckpointPathInput): string {
  const path = sandboxWorkspacePath(identity);

  return `${path}/recovery-checkpoints/${encodeURIComponent(operationId)}`;
}

async function stoppedReceiptSurvivesReplacement(input: MechContext): Promise<void> {
  const sandbox = requireSandbox(input);
  const original = await requestStopReceipt(input);
  const repeated = await requestStopReceipt(input);

  assert.equal(repeated.operationId, original.operationId);

  const receipt = await waitFor({
    name: 'the final environment checkpoint and confirmed provider shutdown',
    read: () => readStopReceipt({ ...input, operationId: original.operationId }),
    accept: (value) => STOP_TERMINAL_PHASES.has(value.phase),
  });

  assert.equal(receipt.phase, SandboxStopPhase.Completed);

  const report = await readSandboxReport(input);

  assert.deepEqual(report.environment.committedGeneration, receipt.generation);
  assert.ok(Option.isNone(report.environment.checkpoint));

  await sandbox.restart({ signal: 'SIGKILL' });

  const retained = await readStopReceipt({ ...input, operationId: original.operationId });

  assert.deepEqual(retained, receipt, 'Environment owner replacement changed the original Stop receipt');
}

type CheckpointFilesInput = { readonly directory: string; readonly cacheMarker: string };

function createCheckpointFilesCommand({ directory, cacheMarker }: CheckpointFilesInput): string {
  const fileSetupSource = [
    'const fs=require("node:fs"),crypto=require("node:crypto"),cache=process.env.MECHANE_CACHE_HOME',
    'if(!cache || cache.startsWith(process.env.HOME+"/"))throw new Error("cache must be outside home")',
    'fs.mkdirSync(cache,{recursive:true})',
    `fs.writeFileSync(cache+"/${cacheMarker}","reconstructible")`,
    'const cipher=crypto.createCipheriv("aes-256-ctr",Buffer.alloc(32),Buffer.alloc(16))',
    `const multipart=cipher.update(Buffer.alloc(${MULTIPART_FILE_BYTES}))`,
    `fs.writeFileSync("${directory}/multipart",multipart)`,
    'process.stdout.write(crypto.createHash("sha256").update(multipart).digest("hex"))',
  ].join(';');

  return `node -e '${fileSetupSource}'`;
}

function sandboxIdentity({ account, mechId }: MechContext): SandboxServiceIdentity {
  return Schema.decodeUnknownSync(SandboxServiceIdentity)({ workspaceId: account.workspaceId, mechId });
}

function requireSandbox({ stack }: MechContext) {
  if (stack.sandbox === undefined) {
    throw new Error('This scenario requires the owned container sandbox');
  }

  return stack.sandbox;
}

type SandboxRequestInput = MechContext & {
  readonly path: string;
  readonly method: HttpMethod;
  readonly body?: Readonly<Record<string, unknown>>;
};

async function readSandboxReport(input: MechContext): Promise<SandboxReport> {
  const path = sandboxWorkspacePath(sandboxIdentity(input));
  const report = await sandboxRequest({ ...input, path, method: HttpMethod.Get });

  return Schema.decodeUnknownSync(SandboxReport)(report);
}

async function sandboxRequest({ path, method, body, ...input }: SandboxRequestInput): Promise<unknown> {
  const sandbox = requireSandbox(input);

  const response = await fetch(new URL(path, sandbox.origin), {
    method,
    headers: { [HttpHeader.Authorization]: `Bearer ${sandbox.bearer}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`The sandbox request returned ${response.status}`);
  }

  return await response.json();
}
