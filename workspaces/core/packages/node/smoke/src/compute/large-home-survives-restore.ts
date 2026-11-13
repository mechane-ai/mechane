import { TurnStatus } from '@mechane/protocol';
import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import {
  createMechContext,
  deleteSandbox,
  readBashResult,
  readEnvironment,
  requestSandboxStop,
  requireFixtures,
  runBash,
  sendNotification,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const FILE_MEBIBYTES = 513;
const PREVIOUS_ARCHIVE_BYTES = 512 * BYTES_PER_MEBIBYTE;
const REQUEST_TIMEOUT_MS = 15_000;
const TRANSFER_TIMEOUT_MS = 300_000;

const STOP_TERMINAL_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Failed,
]);

export async function largeHomeSurvivesRestore({ stack }: ScenarioInput): Promise<void> {
  const marker = `large-home-${randomUUID()}`;
  const input = await createMechContext({ stack, name: marker });
  const { model } = requireFixtures(stack);
  const filename = `.large-home-${randomUUID()}`;

  try {
    const generationSource = [
      'const fs=require("node:fs"),crypto=require("node:crypto")',
      `const file=fs.openSync("${filename}","w"),input=Buffer.alloc(${BYTES_PER_MEBIBYTE})`,
      'const cipher=crypto.createCipheriv("aes-256-ctr",Buffer.alloc(32),Buffer.alloc(16))',
      'const hash=crypto.createHash("sha256")',
      `for(let i=0;i<${FILE_MEBIBYTES};i++){const chunk=cipher.update(input);fs.writeFileSync(file,chunk);hash.update(chunk)}`,
      'fs.closeSync(file)',
      'process.stdout.write(hash.digest("hex"))',
    ].join(';');

    const written = await runBash({ ...input, command: `node -e '${generationSource}'` });

    assert.equal(written.receipt.status, 'completed');
    assert.match(written.result.output, /^[a-f0-9]{64}$/);

    const stop = await requestSandboxStop(input);

    const stopped = await waitFor({
      name: 'a large home to finish its saved drain',
      read: () => requestSandboxStop({ ...input, operationId: stop.operationId }),
      accept: (receipt) => STOP_TERMINAL_PHASES.has(receipt.phase),
      timeoutMs: TRANSFER_TIMEOUT_MS,
    });

    assert.equal(stopped.phase, SandboxStopPhase.Completed);

    const restoreMarker = `restore-${randomUUID()}`;
    const toolCallId = randomUUID();

    const readScript = [
      'const fs=require("node:fs"),crypto=require("node:crypto"),hash=crypto.createHash("sha256")',
      `fs.createReadStream("${filename}").on("data",chunk=>hash.update(chunk)).on("end",()=>process.stdout.write(hash.digest("hex")))`,
    ].join(';');

    model.configure({
      marker: restoreMarker,
      replies: [
        { tools: [{ id: toolCallId, name: 'bash', input: { command: `node -e '${readScript}'` } }] },
        { text: 'The restored file was observed' },
      ],
    });

    const sent = await sendNotification({ ...input, text: restoreMarker });
    const restored = await readBashResult({ model, marker: restoreMarker, toolCallId, timeoutMs: TRANSFER_TIMEOUT_MS });
    const turn = await waitForTurn({ ...input, notificationId: sent.id });
    const report = await readEnvironment({ ...input, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const startup = Option.getOrThrow(report.environment.startup);
    const restoration = Option.getOrThrow(startup.restoration);

    assert.equal(restored.output, written.result.output);
    assert.equal(turn.status, TurnStatus.Completed);
    assert.equal(restoration.generation, Option.getOrThrow(stopped.generation));
    assert.ok(restoration.bytes > PREVIOUS_ARCHIVE_BYTES, 'The fixture did not exceed the old compressed limit');
  } finally {
    await deleteSandbox(input);
  }
}
