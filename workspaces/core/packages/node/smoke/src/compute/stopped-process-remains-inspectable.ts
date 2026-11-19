import {
  requireFixtures,
  runInstalledBash,
  startCommandGate,
  startInstalledProcess,
  waitForInstalledCompletion,
  withInstalledContext,
} from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function stoppedProcessRemainsInspectable({ stack }: ScenarioInput): Promise<void> {
  await withInstalledContext({ stack, name: `stopped-process-${randomUUID()}`, run: verifyStoppedProcess });
}

async function verifyStoppedProcess(context: ManagedContext): Promise<void> {
  const { stack } = context;
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const gate = await startCommandGate({ stack });
  const { model } = requireFixtures(stack);

  try {
    const process = await startInstalledProcess(context, { command: `curl --fail --silent '${gate.url}'` });

    await gate.waitForRequest({ count: 1 });
    await sandbox.loseMachine(process.handle.machineId);

    const modelCalls = model.readCalls().length;
    const lost = await waitForInstalledCompletion(context, process.handle.processId);

    assert.equal(lost.status, 'lost');
    assert.equal(Option.getOrThrow(lost.machineId), process.handle.machineId);

    await stack.restart({ signal: 'SIGKILL' });
    assert.deepEqual(await waitForInstalledCompletion(context, process.handle.processId), lost);
    assert.equal(model.readCalls().length, modelCalls);
    gate.release();

    const result = await runInstalledBash(context, { command: 'printf resumed' });

    assert.equal(result.trim(), 'resumed');
    assert.deepEqual(await waitForInstalledCompletion(context, process.handle.processId), lost);
    assert.equal(gate.readRequests().length, 1, 'The replacement guest restarted a process from the old machine');
  } finally {
    gate.release();
    await gate.close();
  }
}
