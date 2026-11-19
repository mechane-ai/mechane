import { BYTES_PER_MEBIBYTE, HttpMethod, HttpStatusCode } from '@mechane/records';
import {
  SandboxRecoveryCheckpointResult,
  SandboxReport,
  SandboxStopPhase,
  SandboxStopReceipt,
} from '@mechane/sandbox-wire';
import {
  readInstalledComputer,
  requestInstalledComputer,
  runInstalledBash,
  waitFor,
  waitForInstalledRelease,
  withInstalledContext,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { promisify } from 'node:util';

const MULTIPART_FILE_BYTES = 33 * BYTES_PER_MEBIBYTE;

export async function checkpointedFilesSurviveMachineLoss({ stack }: ScenarioInput): Promise<void> {
  const id = randomUUID();
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  await withInstalledContext({
    stack,
    name: `checkpointed-files-${id}`,
    run: async (context) => {
      const directory = `.checkpoint-${id}`;
      const cacheMarker = `cache-${id}`;

      const saved = await runInstalledBash(context, { command: createCheckpointFilesCommand(directory, cacheMarker) });
      const digest = saved.trim();

      assert.match(digest, /^[a-f0-9]{64}$/);

      const initial = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
      const original = await waitForInstalledRelease(context, { machineId: Option.getOrThrow(initial.sandboxId) });

      assert.equal(
        original.receipt.phase,
        SandboxStopPhase.Completed,
        Option.getOrUndefined(original.receipt.lastError),
      );
      assert.ok(original.isPhysicallyAbsent);

      assert.ok(Option.isNone(original.report.environment.checkpoint));

      const head = Option.getOrThrow(original.receipt.generation);

      assert.equal(Option.getOrThrow(original.report.environment.committedGeneration), head);

      await sandbox.restart({ signal: 'SIGKILL' });

      const stopPath = stopReceiptPath(original.receipt);

      assert.deepEqual(await readInstalledComputer(context, SandboxStopReceipt, { path: stopPath }), original.receipt);

      const readFile = `node -e 'const fs=require("node:fs"),crypto=require("node:crypto");process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync("${directory}/multipart")).digest("hex"))'`;

      const contents = await runInstalledBash(context, {
        command: [
          `test ! -e "$MECHANE_CACHE_HOME/${cacheMarker}"`,
          `test -d "$HOME/.cache" && test ! -e "$HOME/.cache/${cacheMarker}"`,
          readFile,
        ].join(' && '),
      });

      assert.equal(contents.trim(), digest);

      const priorToLoss = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
      const machineId = Option.getOrThrow(priorToLoss.sandboxId);

      assert.notEqual(machineId, Option.getOrThrow(initial.sandboxId));

      await sandbox.writeFile({ machineId, path: posix.join('/workspace', directory, 'unsaved'), contents: id });

      const machines = await sandbox.readMachines();
      const otherMachines = machines.filter((machine) => machine !== machineId);

      await sandbox.loseMachine(machineId);

      const afterLoss = await waitForInstalledRelease(context, { machineId });

      assert.ok(afterLoss.isPhysicallyAbsent);
      assert.deepEqual(await sandbox.readMachines(), otherMachines, 'Inspecting the lost guest created a replacement');
      assert.equal(
        afterLoss.receipt.phase,
        SandboxStopPhase.Failed,
        'A lost machine claimed to save its unsaved files',
      );
      assert.equal(Option.getOrThrow(afterLoss.report.environment.committedGeneration), head);

      const recovered = await runInstalledBash(context, { command: `test ! -e '${directory}/unsaved' && ${readFile}` });

      assert.equal(recovered.trim(), digest);
      assert.deepEqual(
        await readInstalledComputer(context, SandboxStopReceipt, { path: stopReceiptPath(afterLoss.receipt) }),
        afterLoss.receipt,
      );

      const corrupt = await runInstalledBash(context, {
        command: `printf retained > '${directory}/live-only' && mkdir '${directory}/unreadable' && chmod 000 '${directory}/unreadable' && printf ready`,
      });

      assert.equal(corrupt.trim(), 'ready');

      const live = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
      const heldMachineId = Option.getOrThrow(live.sandboxId);
      const blocked = await waitForInstalledRelease(context, { machineId: heldMachineId });

      assert.equal(blocked.receipt.phase, SandboxStopPhase.Failed, 'Unreadable files were recorded as saved');
      assert.equal(blocked.isPhysicallyAbsent, false, 'A failed save destroyed its live workspace');
      assert.deepEqual(blocked.report.environment.committedGeneration, live.environment.committedGeneration);

      const recovery = Option.getOrThrow(blocked.report.environment.recovery);
      const seen = await readInstalledComputer(context, Allocation, { path: '/allocation' });

      assert.ok(seen.allocation?.state === 'releasing');

      const repair = {
        generation: seen.allocation.generation,
        machineId: recovery.machineId,
        committedGeneration: Option.getOrNull(blocked.report.environment.committedGeneration),
        recoveryGeneration: recovery.generation,
      };

      const staleLease = await requestInstalledComputer(context, {
        path: recoveryCheckpointPath({ operationId: randomUUID() }),
        method: HttpMethod.Post,
        body: { ...repair, generation: repair.generation + 1 },
      });

      await staleLease.body?.cancel();
      assert.equal(staleLease.status, HttpStatusCode.Conflict);

      const staleFiles = await requestInstalledComputer(context, {
        path: recoveryCheckpointPath({ operationId: randomUUID() }),
        method: HttpMethod.Post,
        body: { ...repair, recoveryGeneration: randomUUID() },
      });

      assert.equal(staleFiles.status, HttpStatusCode.Conflict);
      assert.deepEqual(Schema.decodeUnknownSync(SandboxRecoveryCheckpointResult)(await staleFiles.json()), {
        _tag: 'RecoveryCheckpointRefused',
        reason: 'workspace_changed',
      });

      const after = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });

      assert.deepEqual(after.environment.recovery, blocked.report.environment.recovery);
      assert.equal(
        await sandbox.readFile({ machineId: heldMachineId, path: posix.join('/workspace', directory, 'live-only') }),
        'retained',
      );

      // Undo only our permission fault on the retained guest before retrying the real owner checkpoint.
      const machine = await sandbox.inspectMachine(heldMachineId);

      assert.ok(machine !== undefined);
      await promisify(execFile)('docker', [
        'exec',
        machine.containerId,
        'chmod',
        '700',
        posix.join('/workspace', directory, 'unreadable'),
      ]);

      const repairPath = recoveryCheckpointPath({ operationId: randomUUID() });

      await readInstalledComputer(context, SandboxRecoveryCheckpointResult, {
        path: repairPath,
        method: HttpMethod.Post,
        body: repair,
      });

      const savedReceipt = await waitFor({
        name: 'the owner to save the repaired guest without starting another worker',
        read: () => readInstalledComputer(context, SandboxRecoveryCheckpointResult, { path: repairPath }),
        accept: (receipt) => receipt._tag !== 'Pending',
      });

      assert.equal(savedReceipt._tag, 'Committed');

      const released = await waitForInstalledRelease(context, {
        machineId: heldMachineId,
        afterOperationId: blocked.receipt.operationId,
      });

      assert.equal(
        released.receipt.phase,
        SandboxStopPhase.Completed,
        Option.getOrUndefined(released.receipt.lastError),
      );
      assert.ok(released.isPhysicallyAbsent);

      const preserved = await runInstalledBash(context, { command: `cat '${directory}/live-only'` });

      assert.equal(preserved.trim(), 'retained');
      assert.deepEqual(
        await readInstalledComputer(context, SandboxStopReceipt, { path: stopReceiptPath(blocked.receipt) }),
        blocked.receipt,
      );
    },
  });
}

const Allocation = Schema.Struct({
  allocation: Schema.NullOr(
    Schema.Struct({ generation: Schema.Int, state: Schema.Literals(['active', 'releasing', 'released']) }),
  ),
});

function stopReceiptPath({ operationId }: Pick<SandboxStopReceipt, 'operationId'>): string {
  return `/stop/${operationId}`;
}

function recoveryCheckpointPath({ operationId }: { readonly operationId: string }): string {
  return `/workspace/recovery-checkpoints/${operationId}`;
}

function createCheckpointFilesCommand(directory: string, cacheMarker: string): string {
  const fileSetupSource = [
    'const fs=require("node:fs"),crypto=require("node:crypto"),cache=process.env.MECHANE_CACHE_HOME',
    'if(!cache || cache.startsWith(process.env.HOME+"/"))throw new Error("cache must be outside home")',
    'fs.mkdirSync(cache,{recursive:true})',
    `fs.mkdirSync("${directory}")`,
    `fs.writeFileSync(cache+"/${cacheMarker}","reconstructible")`,
    `fs.writeFileSync(process.env.HOME+"/.cache/${cacheMarker}","reconstructible")`,
    'const cipher=crypto.createCipheriv("aes-256-ctr",Buffer.alloc(32),Buffer.alloc(16))',
    `const multipart=cipher.update(Buffer.alloc(${MULTIPART_FILE_BYTES}))`,
    `fs.writeFileSync("${directory}/multipart",multipart)`,
    'process.stdout.write(crypto.createHash("sha256").update(multipart).digest("hex"))',
  ].join(';');

  return `node -e '${fileSetupSource}'`;
}
