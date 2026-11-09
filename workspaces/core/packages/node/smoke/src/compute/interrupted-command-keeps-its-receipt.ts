import { TurnStatus, Workspace } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  deleteSandbox,
  readBashResult,
  readSandboxMachines,
  readTrace,
  requireFixtures,
  runBash,
  runCli,
  sendNotification,
  setMachineLimit,
  waitFor,
  waitForBashCompletion,
  waitForSandboxFile,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const WORKFLOW_RECOVERY_WAIT_MS = 60_000;
const COMMAND_TIMEOUT_MS = 120_000;
const COMPLETED_COMMAND_MODEL_CALLS = 2;

export async function interruptedCommandKeepsItsReceipt({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const administrator = await createAccount({ stack, login: fixtures.github.users.owner.login });
  const marker = `interrupted-command-${randomUUID()}`;

  const workspace = await runCli({
    stack,
    account: administrator,
    args: ['workspace', 'create', '--name', marker],
    schema: Workspace,
  });

  const account = { ...administrator, workspaceId: workspace.id };

  const mechs = await Promise.all([
    createMech({ stack, account, name: `${marker}-first` }),
    createMech({ stack, account, name: `${marker}-second` }),
  ]);

  const primary = mechs[0];
  const model = fixtures.model;
  const directory = `.smoke-${randomUUID()}`;
  const initialMachines = await readSandboxMachines(stack);
  const cleanupFailures: Array<unknown> = [];

  try {
    await setMachineLimit({ stack, account, machines: 0 });

    const disabled = await runBash({ stack, account, mechId: primary.id, command: 'printf disabled' });

    assert.equal(disabled.result.status, 'refused');
    assert.equal(disabled.turn.status, TurnStatus.Completed);
    assert.deepEqual(await readSandboxMachines(stack), initialMachines, 'Zero capacity started a physical machine');

    await setMachineLimit({ stack, account, machines: 1 });

    const command = [
      `mkdir -p '${directory}'`,
      `printf '%s\\n' '${marker}' >> '${directory}/effects'`,
      `while [ ! -f '${directory}/release' ]; do sleep 0.05; done`,
      `cat '${directory}/effects'`,
    ].join('\n');

    const candidates = mechs.map((mech) => ({
      stack,
      account,
      mechId: mech.id,
      marker: `${marker}-${mech.id}`,
      toolCallId: randomUUID(),
    }));

    for (const candidate of candidates) {
      model.configure({
        marker: candidate.marker,
        replies: [
          {
            isHeld: true,
            tools: [{ id: candidate.toolCallId, name: 'bash', input: { command, timeoutMs: COMMAND_TIMEOUT_MS } }],
          },
          { text: 'The command result was observed' },
        ],
      });
    }

    const admitted = await Promise.all(
      candidates.map(async (candidate) => {
        const sent = await sendNotification({ ...candidate, text: candidate.marker });

        return { ...candidate, notificationId: sent.id };
      }),
    );

    try {
      await Promise.all(candidates.map((candidate) => model.waitForCall({ marker: candidate.marker, index: 0 })));
    } finally {
      for (const candidate of candidates) {
        model.release({ marker: candidate.marker, index: 0 });
      }
    }

    const effect = await waitForSandboxFile({ stack, path: join(directory, 'effects'), contents: `${marker}\n` });

    const refused = await waitFor({
      name: 'one concurrent command to be refused by workspace capacity',
      read: async () => admitted.find((candidate) => model.readCalls({ marker: candidate.marker }).length > 1),
      accept: (candidate) => candidate !== undefined,
    });

    assert.ok(refused !== undefined);

    const winner = admitted.find((candidate) => candidate.mechId !== refused.mechId);

    assert.ok(winner !== undefined);

    const refusal = await readBashResult({ model, ...refused });

    assert.equal(refusal.status, 'refused', 'Concurrent mechs exceeded the workspace machine limit');

    const refusedTurn = await waitForTurn(refused);

    assert.equal(refusedTurn.status, TurnStatus.Completed, 'A capacity refusal blocked later work');

    const allocatedMachines = await readSandboxMachines(stack);

    assert.equal(allocatedMachines.length, initialMachines.length + 1);

    try {
      await stack.restart({ signal: 'SIGKILL' });
    } finally {
      await writeFile(join(dirname(effect), 'release'), 'continue\n');
    }

    const { result, turn } = await waitForBashCompletion({ ...winner, timeoutMs: WORKFLOW_RECOVERY_WAIT_MS });

    assert.equal(result.output, `${marker}\n`);
    assert.equal(await readFile(effect, 'utf8'), `${marker}\n`, 'The resumed command repeated its side effect');
    assert.equal(
      model.readCalls({ marker: winner.marker }).length,
      COMPLETED_COMMAND_MODEL_CALLS,
      'Recovery repeated the completed model request',
    );

    const trace = await readTrace({ ...winner, turnId: turn.id });
    const tool = trace.toolCalls?.find((call) => call.id === winner.toolCallId);

    assert.ok(tool?.inspection !== undefined);
    assert.equal(Option.getOrThrow(tool.inspection.command).text, command);

    const inspectedResult = Option.getOrThrow(tool.inspection.result);

    assert.equal(Option.getOrThrow(inspectedResult.output).text, `${marker}\n`);
    assert.equal(Option.getOrThrow(inspectedResult.exitCode), 0);
    await stack.restart();

    const replayed = await readTrace({ ...winner, turnId: turn.id });

    assert.deepEqual(replayed.toolCalls, trace.toolCalls, 'Restart changed the same execution evidence');

    const persisted = await runBash({ ...winner, command: `cat '${directory}/effects'` });

    assert.equal(persisted.result.status, 'completed');
    assert.equal(persisted.result.output, `${marker}\n`);

    const reusedMachines = await readSandboxMachines(stack);

    assert.deepEqual(reusedMachines, allocatedMachines);
    await setMachineLimit({ stack, account, machines: 0 });

    const disabledWarm = await runBash({ ...winner, command: 'printf disabled-warm' });

    assert.equal(disabledWarm.result.status, 'refused', 'Zero capacity dispatched through an already-warm machine');
    await setMachineLimit({ stack, account, machines: 1 });

    const stillFull = await runBash({ ...refused, command: 'printf over-capacity' });

    assert.equal(stillFull.result.status, 'refused', 'Completing a run released its still-live machine allocation');

    const retainedMachines = await readSandboxMachines(stack);

    assert.deepEqual(retainedMachines, allocatedMachines);

    await deleteSandbox(winner);

    const separated = await runBash({
      ...refused,
      command: `test ! -e '${directory}/effects' && printf 'separate\\n'`,
    });

    assert.equal(separated.result.status, 'completed');
    assert.equal(separated.result.exitCode, 0);
    assert.equal(separated.result.output, 'separate\n');
  } finally {
    const cleanup = await Promise.allSettled(mechs.map((mech) => deleteSandbox({ stack, account, mechId: mech.id })));

    for (const result of cleanup) {
      if (result.status === 'rejected') {
        const reason: unknown = result.reason;

        cleanupFailures.push(reason);
      }
    }
  }

  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, 'Could not release every compute scenario sandbox');
  }
}
