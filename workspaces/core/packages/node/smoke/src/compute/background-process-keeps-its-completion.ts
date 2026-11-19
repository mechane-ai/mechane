import { InstalledProcessCompletion, ProcessObservation } from '@mechane/sandbox-wire';
import {
  installedComputerResourcePath,
  readInstalledComputer,
  requireFixtures,
  runInstalledBash,
  startCommandGate,
  startInstalledProcess,
  waitForInstalledCompletion,
  withInstalledContext,
} from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function backgroundProcessKeepsItsCompletion({ stack }: ScenarioInput): Promise<void> {
  await withInstalledContext({ stack, name: `background-${randomUUID()}`, run: verifyBackgroundProcess });
}

async function verifyBackgroundProcess(context: ManagedContext): Promise<void> {
  const { stack } = context;
  const { model } = requireFixtures(stack);
  const gate = await startCommandGate({ stack });
  const processId = randomUUID();
  const marker = `"$HOME/background-${processId}"`;
  const command = `curl --fail --silent '${gate.url}' && printf finished > ${marker}`;

  try {
    const process = await startInstalledProcess(context, { command, processId });

    assert.equal(process.state._tag, 'Running');
    await gate.waitForRequest({ count: 1 });

    const foreground = await runInstalledBash(context, { command: `test ! -e ${marker} && printf concurrent` });

    assert.equal(foreground.trim(), 'concurrent');

    const modelCalls = model.readCalls().length;

    gate.release();

    const receipt = await waitForInstalledCompletion(context, processId);

    assert.equal(receipt.status, 'exited');
    assert.equal(receipt.kind, 'process');
    assert.equal(receipt.executionId, processId);
    assert.equal(receipt.origin.actionId, processId);
    assert.equal(receipt.origin.sessionId, context.session.id);
    assert.equal(receipt.origin.environmentId, context.environment.id);
    assert.equal(Option.getOrThrow(receipt.exitCode), 0);
    assert.equal(Option.getOrThrow(receipt.machineId), process.handle.machineId);

    await stack.restart({ signal: 'SIGKILL' });
    assert.deepEqual(await waitForInstalledCompletion(context, processId), receipt);
    assert.equal(model.readCalls().length, modelCalls, 'Observing a terminal process activated the agent');

    const page = await readInstalledComputer(
      context,
      Schema.Struct({ receipts: Schema.Array(InstalledProcessCompletion) }),
      { path: '/completions' },
    );

    assert.deepEqual(
      page.receipts.filter((completion) => completion.executionId === processId),
      [receipt],
    );

    const replay = await readInstalledComputer(context, ProcessObservation, {
      path: installedComputerResourcePath({ collection: 'processes', id: processId }),
    });

    assert.equal(replay.state._tag, 'Exited');
    assert.deepEqual(replay.handle, process.handle);
    assert.equal(gate.readRequests().length, 1, 'Recovering the original process repeated its external effect');
  } finally {
    gate.release();
    await gate.close();
  }
}
