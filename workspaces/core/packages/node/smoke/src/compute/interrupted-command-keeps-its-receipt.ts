import { TurnStatus, Workspace } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { SandboxExecutionIdentity, sandboxExecutionPath, SandboxExecutionResult } from '@mechane/sandbox-wire';
import {
  createAccount,
  createMech,
  deleteSandbox,
  readBashResult,
  readEnvironment,
  readSandboxMachines,
  readTrace,
  requireFixtures,
  runBash,
  runCli,
  sendNotification,
  setMachineLimit,
  startCommandGate,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { checkpointedFilesSurviveMachineLoss } from './checkpointed-files-survive-machine-loss.ts';

const ENVIRONMENT_READ_TIMEOUT_MS = 2000;
const COMMAND_RECOVERY_WAIT_MS = 60_000;
const COMMAND_TIMEOUT_SECONDS = 120;
const COMPLETED_COMMAND_MODEL_CALLS = 2;
const COMMAND_OWNER_RESTARTS = 6;

export async function interruptedCommandKeepsItsReceipt({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

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
  const gate = await startCommandGate({ stack });

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
      `curl --fail --silent '${gate.url}'`,
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
            tools: [{ id: candidate.toolCallId, name: 'bash', input: { command, timeout: COMMAND_TIMEOUT_SECONDS } }],
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

    await gate.waitForRequest({ count: 1 });

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

    const machineId = allocatedMachines.find((identity) => !initialMachines.includes(identity));

    assert.ok(machineId !== undefined);

    const physicalMachine = await sandbox.inspectMachine(machineId);

    assert.ok(physicalMachine !== undefined);

    const overview = await readEnvironment({ ...winner, signal: AbortSignal.timeout(ENVIRONMENT_READ_TIMEOUT_MS) });
    const startup = Option.getOrThrow(overview.environment.startup);

    assert.equal(startup.machineId, machineId, 'Startup inspection described a different computer');
    assert.ok(Option.isSome(overview.environment.execution));

    const correctionMarker = `correction-${randomUUID()}`;

    model.configure({ marker: correctionMarker, replies: [{ text: 'The correction was observed' }] });

    const correction = await sendNotification({ ...winner, notificationId: randomUUID(), text: correctionMarker });

    try {
      for (let restart = 0; restart < COMMAND_OWNER_RESTARTS; restart += 1) {
        await stack.restart({ signal: 'SIGKILL' });
      }

      assert.deepEqual(await sandbox.inspectMachine(machineId), physicalMachine);
    } finally {
      gate.release();
    }

    const result = await readBashResult({
      model,
      ...winner,
      marker: correctionMarker,
      index: 0,
      timeoutMs: COMMAND_RECOVERY_WAIT_MS,
    });

    const turn = await waitForTurn(winner);

    assert.equal(turn.status, TurnStatus.Completed);
    assert.equal(result.status, 'completed');
    assert.equal(result.exitCode, 0);

    assert.equal(result.output, `${marker}\n`);

    const executionIdentity = Schema.decodeUnknownSync(SandboxExecutionIdentity)({
      workspaceId: account.workspaceId,
      mechId: winner.mechId,
      executionId: result.executionId,
    });

    const executionPath = sandboxExecutionPath(executionIdentity);

    const receiptResponse = await fetch(new URL(executionPath, sandbox.origin), {
      headers: { authorization: `Bearer ${sandbox.bearer}` },
      signal: AbortSignal.timeout(COMMAND_RECOVERY_WAIT_MS),
    });

    assert.equal(receiptResponse.status, HttpStatusCode.Ok);

    const receipt = Schema.decodeUnknownSync(SandboxExecutionResult)(await receiptResponse.json());

    assert.equal(receipt._tag, 'Exited');

    assert.equal(receipt.exitCode, 0);
    assert.equal(receipt.output.text, result.output);

    const correctionTurn = await waitForTurn({ ...winner, notificationId: correction.id });

    assert.equal(
      correctionTurn.status,
      TurnStatus.Completed,
      'The correction was stranded behind the admitted command',
    );
    assert.equal(gate.readRequests().length, 1, 'The resumed command repeated its external effect');
    assert.equal(
      model.readCalls({ marker: winner.marker }).length + model.readCalls({ marker: correctionMarker }).length,
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

    await checkpointedFilesSurviveMachineLoss({ ...winner, directory });

    await deleteSandbox(winner);

    const separated = await runBash({
      ...refused,
      command: `test ! -e '${directory}/effects' && printf 'separate\\n'`,
    });

    assert.equal(separated.result.status, 'completed');
    assert.equal(separated.result.exitCode, 0);
    assert.equal(separated.result.output, 'separate\n');
  } catch (cause) {
    await stack.captureFailure('interruptedCommandKeepsItsReceipt:before-sandbox-cleanup').catch(() => undefined);

    throw cause;
  } finally {
    gate.release();

    const cleanup = await Promise.allSettled(mechs.map((mech) => deleteSandbox({ stack, account, mechId: mech.id })));

    for (const result of cleanup) {
      if (result.status === 'rejected') {
        const reason: unknown = result.reason;

        cleanupFailures.push(reason);
      }
    }

    await gate.close();
  }

  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, 'Could not release every compute scenario sandbox');
  }
}
