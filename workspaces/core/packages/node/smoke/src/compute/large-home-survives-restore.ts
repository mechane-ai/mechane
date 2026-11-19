import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { SandboxReport, SandboxStopPhase } from '@mechane/sandbox-wire';
import {
  readInstalledComputer,
  runInstalledBash,
  waitForInstalledRelease,
  withInstalledContext,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const FILE_MEBIBYTES = 513;
const PREVIOUS_ARCHIVE_BYTES = 512 * BYTES_PER_MEBIBYTE;
const TRANSFER_TIMEOUT_MS = 300_000;

export async function largeHomeSurvivesRestore({ stack }: ScenarioInput): Promise<void> {
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const replacement: { machineId?: string } = {};

  await withInstalledContext({
    stack,
    name: `large-home-${randomUUID()}`,
    run: async (context) => {
      const filename = `.large-home-${randomUUID()}`;

      const generationSource = [
        'const fs=require("node:fs"),crypto=require("node:crypto")',
        `const file=fs.openSync("${filename}","w"),input=Buffer.alloc(${BYTES_PER_MEBIBYTE})`,
        'const cipher=crypto.createCipheriv("aes-256-ctr",Buffer.alloc(32),Buffer.alloc(16))',
        'const hash=crypto.createHash("sha256")',
        `for(let i=0;i<${FILE_MEBIBYTES};i++){const chunk=cipher.update(input);fs.writeFileSync(file,chunk);hash.update(chunk)}`,
        'fs.closeSync(file)',
        'process.stdout.write(hash.digest("hex"))',
      ].join(';');

      const output = await runInstalledBash(context, {
        command: `node -e '${generationSource}'`,
        timeoutMs: TRANSFER_TIMEOUT_MS,
      });

      const written = output.trim();

      assert.match(written, /^[a-f0-9]{64}$/);

      const live = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
      const machineId = Option.getOrThrow(live.sandboxId);

      const { receipt, isPhysicallyAbsent } = await waitForInstalledRelease(context, {
        machineId,
        timeoutMs: TRANSFER_TIMEOUT_MS,
      });

      assert.equal(receipt.phase, SandboxStopPhase.Completed, Option.getOrUndefined(receipt.lastError));
      assert.ok(isPhysicallyAbsent, 'The first guest survived its completed lease release');

      const readScript = [
        'const fs=require("node:fs"),crypto=require("node:crypto"),hash=crypto.createHash("sha256")',
        `fs.createReadStream("${filename}").on("data",chunk=>hash.update(chunk)).on("end",()=>process.stdout.write(hash.digest("hex")))`,
      ].join(';');

      const restored = await runInstalledBash(context, {
        command: `node -e '${readScript}'`,
        timeoutMs: TRANSFER_TIMEOUT_MS,
      });

      assert.equal(restored.trim(), written);

      const report = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
      const startup = Option.getOrThrow(report.environment.startup);
      const restoration = Option.getOrThrow(startup.restoration);

      replacement.machineId = Option.getOrThrow(report.sandboxId);

      assert.notEqual(replacement.machineId, machineId);
      assert.equal(restoration.generation, Option.getOrThrow(receipt.generation));
      assert.ok(restoration.bytes > PREVIOUS_ARCHIVE_BYTES, 'The fixture did not exceed the old compressed limit');
    },
  });

  assert.ok(replacement.machineId !== undefined);
  assert.equal(
    await sandbox.inspectMachine(replacement.machineId),
    undefined,
    'Deleting the session left its guest running',
  );
}
