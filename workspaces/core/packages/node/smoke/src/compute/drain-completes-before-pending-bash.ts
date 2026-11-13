import { TurnStatus } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  SandboxCompletionAccepted,
  SandboxCompletionReceipt,
  sandboxExecutionCancelPendingPath,
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
  sandboxPendingCompletionsPath,
  SandboxServiceIdentity,
  sandboxStopPath,
  SandboxStopPhase,
  sandboxStopReadPath,
  SandboxStopReceipt,
} from '@mechane/sandbox-wire';
import {
  createMechContext,
  deleteSandbox,
  readBashResult,
  readSandboxCompletion,
  readTrace,
  requireFixtures,
  runBash,
  sendNotification,
  startCommandGate,
  waitFor,
  waitForPendingExecution,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 15_000;
const DRAIN_TIMEOUT_MS = 30_000;
const BLOCKER_TIMEOUT_MS = 120_000;

const STOP_TERMINAL_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Failed,
]);

export async function drainCompletesBeforePendingBash({ stack }: ScenarioInput): Promise<void> {
  const marker = `drain-bash-${randomUUID()}`;
  const input = await createMechContext({ stack, name: marker });
  const { account, mechId } = input;
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const { origin, bearer } = sandbox;
  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)({ workspaceId: account.workspaceId, mechId });
  const stopPath = sandboxStopPath(identity);
  const { model } = requireFixtures(stack);
  const gate = await startCommandGate({ stack });
  const blockerId = randomUUID();
  const toolCallId = randomUUID();
  const filename = `.drain-once-${randomUUID()}`;
  const pending = { id: '' };

  function executionPath(executionId: string): string {
    const execution = Schema.decodeUnknownSync(SandboxExecutionIdentity)({ ...identity, executionId });

    return sandboxExecutionPath(execution);
  }

  async function request(path: string, method: HttpMethod, body?: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: { [HttpHeader.Authorization]: `Bearer ${bearer}`, [HttpHeader.ContentType]: MediaType.Json },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    assert.ok(response.ok, `Sandbox request returned ${response.status}`);

    return await response.json();
  }

  async function readStop(operationId: SandboxStopReceipt['operationId']): Promise<SandboxStopReceipt> {
    const path = sandboxStopReadPath({ ...identity, operationId });

    return Schema.decodeUnknownSync(SandboxStopReceipt)(await request(path, HttpMethod.Get));
  }

  try {
    const ready = await runBash({ ...input, command: 'printf ready' });

    assert.equal(ready.result.output, 'ready');

    const started = Schema.decodeUnknownSync(SandboxExecutionResult)(
      await request(executionPath(blockerId), HttpMethod.Post, {
        command: `curl --fail --silent '${gate.url}'`,
        timeoutMs: BLOCKER_TIMEOUT_MS,
        waitMs: 0,
        environment: { variables: {}, secrets: {} },
      }),
    );

    assert.equal(started._tag, 'Running');
    await gate.waitForRequest({ count: 1 });

    const original = Schema.decodeUnknownSync(SandboxStopReceipt)(await request(stopPath, HttpMethod.Post));

    await waitFor({
      name: 'the original stop to wait for the held command',
      read: () => readStop(original.operationId),
      accept: (receipt) => receipt.phase === SandboxStopPhase.WaitingForCommands,
      timeoutMs: DRAIN_TIMEOUT_MS,
    });

    model.configure({
      marker,
      replies: [
        { tools: [{ id: toolCallId, name: 'bash', input: { command: `printf 'once\\n' >> '${filename}'` } }] },
        { text: 'The command result was observed' },
      ],
    });

    const sent = await sendNotification({ ...input, text: marker });

    pending.id = await waitForPendingExecution({
      ...input,
      excludeExecutionId: blockerId,
      timeoutMs: DRAIN_TIMEOUT_MS,
    });

    const observed = Schema.decodeUnknownSync(SandboxExecutionResult)(
      await request(executionPath(pending.id), HttpMethod.Get),
    );

    assert.equal(observed._tag, 'ExecutionEnvironmentRequired');
    gate.release();

    const stopped = await waitFor({
      name: 'the original stop to complete despite the pending actor command',
      read: () => readStop(original.operationId),
      accept: (receipt) => STOP_TERMINAL_PHASES.has(receipt.phase),
      timeoutMs: DRAIN_TIMEOUT_MS,
    });

    assert.equal(stopped.phase, SandboxStopPhase.Completed);
    assert.equal(stopped.operationId, original.operationId);
    assert.deepEqual(stopped.machineId, original.machineId);

    const blocker = await readSandboxCompletion({ ...input, executionId: blockerId });

    assert.ok(blocker !== null);
    assert.equal(blocker.status, 'exited');
    assert.equal(Option.getOrThrow(blocker.exitCode), 0);

    const receipt = Schema.encodeSync(SandboxCompletionReceipt)(blocker);
    const acknowledged = await request(sandboxPendingCompletionsPath(identity), HttpMethod.Post, receipt);

    Schema.decodeUnknownSync(SandboxCompletionAccepted)(acknowledged);

    await readBashResult({ model, marker, toolCallId });

    const turn = await waitForTurn({ ...input, notificationId: sent.id });
    const trace = await readTrace({ ...input, turnId: turn.id });
    const tool = trace.toolCalls?.find((call) => call.id === toolCallId);

    assert.equal(turn.status, TurnStatus.Completed);
    assert.ok(tool?.inspection !== undefined);
    assert.equal(tool.inspection.executionId, pending.id);
    assert.equal(Option.getOrThrow(tool.inspection.result).status, 'completed');

    const checked = await runBash({ ...input, command: `test "$(wc -l < '${filename}')" -eq 1 && cat '${filename}'` });

    assert.equal(checked.result.output, 'once\n');
    assert.equal(gate.readRequests().length, 1);
  } finally {
    gate.release();

    if (pending.id !== '') {
      const execution = Schema.decodeUnknownSync(SandboxExecutionIdentity)({ ...identity, executionId: pending.id });
      const path = sandboxExecutionCancelPendingPath(execution);

      const response = await fetch(new URL(path, origin), {
        method: HttpMethod.Post,
        headers: { [HttpHeader.Authorization]: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      assert.equal(response.status, HttpStatusCode.Ok);
    }

    await gate.close();
    await deleteSandbox(input);
  }
}
