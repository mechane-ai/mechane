import { ToolCallStatus, TurnStatus } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  sandboxExecutionCancelPendingPath,
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
} from '@mechane/sandbox-wire';
import {
  readBashResult,
  readEnvironment,
  readTrace,
  requireFixtures,
  runBash,
  sendNotification,
  startCommandGate,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 15_000;
const TERMINAL_TOOL_STATES: ReadonlySet<ToolCallStatus> = new Set([ToolCallStatus.Completed, ToolCallStatus.Failed]);

/** A correction must not wait for the startup deadline of a command that current admission refuses to dispatch. */
export async function correctionRefusesPendingCommand({ stack, account, mechId }: MechContext): Promise<void> {
  const input = { stack, account, mechId };
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const { origin, bearer } = sandbox;
  const { model } = requireFixtures(stack);
  const gate = await startCommandGate({ stack });
  const blockerId = randomUUID();
  const marker = `pending-correction-${randomUUID()}`;
  const staleFile = `.stale-${randomUUID()}`;
  const toolCallId = randomUUID();

  function identity(executionId: string): SandboxExecutionIdentity {
    return Schema.decodeUnknownSync(SandboxExecutionIdentity)({
      workspaceId: account.workspaceId,
      mechId,
      executionId,
    });
  }

  async function request(path: string, method: HttpMethod, body?: unknown): Promise<SandboxExecutionResult> {
    const encodedBody = JSON.stringify(body);

    const response = await fetch(new URL(path, origin), {
      method,
      headers: { [HttpHeader.Authorization]: `Bearer ${bearer}`, [HttpHeader.ContentType]: MediaType.Json },
      body: encodedBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    assert.equal(response.status, HttpStatusCode.Ok);

    return Schema.decodeUnknownSync(SandboxExecutionResult)(await response.json());
  }

  const blockerPath = sandboxExecutionPath(identity(blockerId));

  try {
    const started = await request(blockerPath, HttpMethod.Post, {
      command: `curl --fail --silent '${gate.url}'`,
      timeoutMs: 60_000,
      waitMs: 0,
      environment: { variables: {}, secrets: {} },
    });

    assert.equal(started._tag, 'Running');
    await gate.waitForRequest({ count: 1 });

    const raced = await request(sandboxExecutionCancelPendingPath(identity(blockerId)), HttpMethod.Post);

    assert.equal(raced._tag, 'Running', 'Pending-only cancellation stopped an already dispatched command');

    model.configure({
      marker,
      replies: [
        { tools: [{ id: toolCallId, name: 'bash', input: { command: `printf stale > '${staleFile}'` } }] },
        { text: 'The correction was observed' },
      ],
    });

    const original = await sendNotification({ ...input, text: marker });

    const pending = await waitFor({
      name: 'the native shell claim before dispatch',
      read: async () => {
        const report = await readEnvironment({ ...input, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

        return report.environment.execution;
      },
      accept: (execution) =>
        Option.exists(execution, (value) => value.executionId !== blockerId && Option.isNone(value.dispatchedAt)),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const pendingId = Option.getOrThrow(pending).executionId;
    const correction = await sendNotification({ ...input, text: `${marker}: do not run the old command` });

    const result = await readBashResult({ model, marker, toolCallId, timeoutMs: REQUEST_TIMEOUT_MS });

    assert.ok(result.output.includes(`Execution ${pendingId}: refused.`));

    const reconsideration = await model.waitForCall({ marker, index: 1, timeoutMs: REQUEST_TIMEOUT_MS });

    assert.ok(JSON.stringify(reconsideration.body['messages']).includes(correction.id));

    const turn = await waitForTurn({ ...input, notificationId: correction.id });

    assert.equal(turn.status, TurnStatus.Completed);
    assert.ok(turn.notificationIds.includes(original.id));

    const refused = await request(sandboxExecutionPath(identity(pendingId)), HttpMethod.Get);

    assert.equal(refused._tag, 'Unavailable', 'The refused shell retained an orphaned pending claim');

    const trace = await readTrace({ ...input, turnId: turn.id });
    const tool = trace.toolCalls?.find((call) => call.id === toolCallId);

    assert.ok(tool !== undefined && TERMINAL_TOOL_STATES.has(tool.status));
    assert.ok(tool.inspection !== undefined);
    assert.equal(tool.inspection.executionId, pendingId);
    assert.equal(Option.getOrThrow(tool.inspection.result).status, 'refused');

    gate.release();

    const settled = await waitFor({
      name: 'the original dispatched command to finish',
      read: () => request(blockerPath, HttpMethod.Get),
      accept: (receipt) => receipt._tag === 'Exited',
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    assert.deepEqual(await request(sandboxExecutionCancelPendingPath(identity(blockerId)), HttpMethod.Post), settled);

    const checked = await runBash({ ...input, command: `test ! -e '${staleFile}' && printf current` });

    assert.equal(checked.receipt.status, 'completed');
    assert.equal(checked.result.output, 'current');
    assert.equal(gate.readRequests().length, 1, 'Cancellation replayed the original dispatched command');
  } finally {
    gate.release();
    await gate.close();
  }
}
