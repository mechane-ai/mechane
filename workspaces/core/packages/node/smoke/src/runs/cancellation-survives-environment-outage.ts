import { TurnCancel, TurnStatus } from '@mechane/protocol';
import { sandboxInteractiveCancelPath, SandboxRunIdentity } from '@mechane/sandbox-wire';
import {
  deleteSandbox,
  readConsoleMessages,
  readSandboxCompletion,
  readTrace,
  requireFixtures,
  runCli,
  startCancellationGate,
  startCommandGate,
  startHeldActivation,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { CancellationGate, MechContext } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const COMMAND_TIMEOUT_SECONDS = 120;

export async function cancellationSurvivesEnvironmentOutage(owner: MechContext): Promise<void> {
  const sandbox = owner.stack.sandbox;

  assert.ok(sandbox !== undefined);

  const environmentOrigin = sandbox.origin.origin;
  const marker = `cancel-outage-${randomUUID()}`;
  const toolCallId = randomUUID();
  const { model } = requireFixtures(owner.stack);
  const gate = await startCommandGate();
  const failures: Array<unknown> = [];
  const resources: { cancellationGate?: CancellationGate } = {};
  let isOutageConfigured = false;

  model.configure({
    marker,
    replies: [
      {
        isHeld: true,
        tools: [
          {
            id: toolCallId,
            name: 'bash',
            input: { command: `curl --fail --silent '${gate.url}'`, timeout: COMMAND_TIMEOUT_SECONDS },
          },
        ],
      },
      { text: 'Cancelled work must not request another model result' },
    ],
  });

  try {
    const { notification, turn } = await startHeldActivation({ ...owner, marker });

    model.release({ marker, index: 0 });
    await gate.waitForRequest({ count: 1 });

    const address = { ...owner, turnId: turn.id };

    const admitted = await waitFor({
      name: 'the admitted command to expose its durable receipt identity',
      read: () => readTrace(address),
      accept: (trace) =>
        trace.toolCalls?.some((call) => call.id === toolCallId && call.inspection?.executionId !== undefined) ?? false,
    });

    const executionId = admitted.toolCalls?.find((call) => call.id === toolCallId)?.inspection?.executionId;

    assert.ok(executionId !== undefined);

    const conversation = await readConsoleMessages(owner);

    const identity = Schema.decodeUnknownSync(SandboxRunIdentity)({
      workspaceId: owner.account.workspaceId,
      mechId: owner.mechId,
      runId: turn.id,
    });

    resources.cancellationGate = await startCancellationGate({
      origin: sandbox.origin,
      path: sandboxInteractiveCancelPath(identity),
    });

    isOutageConfigured = true;

    await owner.stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: resources.cancellationGate.origin.origin } });

    const args = ['turn', 'cancel', owner.mechId, turn.id, '--workspace', owner.account.workspaceId];
    const cancellation = await runCli({ ...owner, args, schema: TurnCancel });

    assert.equal(cancellation.turnId, turn.id);

    const heldCancellation = resources.cancellationGate;

    await waitFor({
      name: 'the cancellation alarm to reach the held environment endpoint after returning its receipt',
      read: async () => heldCancellation.readRequestCount(),
      accept: (count) => count > 0,
    });
    await waitFor({
      name: 'the accepted cancellation to abort native work during the environment outage',
      read: () => readTrace(address),
      accept: (trace) => trace.turn.status === TurnStatus.Stopped,
    });
    await owner.stack.restart({ signal: 'SIGKILL' });
    assert.deepEqual(await runCli({ ...owner, args, schema: TurnCancel }), cancellation);

    resources.cancellationGate.release();
    await owner.stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: environmentOrigin } });

    isOutageConfigured = false;

    const receipt = await waitFor({
      name: 'the interrupted cancellation to reconcile its original environment receipt',
      read: () => readSandboxCompletion({ ...owner, executionId }),
      accept: (completion) => completion !== null,
    });

    assert.ok(receipt !== null);
    assert.equal(receipt.executionId, executionId);

    const stopped = await waitForTurn({ ...owner, notificationId: notification.id });

    assert.equal(stopped.status, TurnStatus.Stopped);
    assert.deepEqual(await runCli({ ...owner, args, schema: TurnCancel }), cancellation);
    assert.equal(gate.readRequests().length, 1, 'Cancellation recovery repeated the admitted command');
    assert.equal(model.readCalls({ marker }).length, 1, 'Cancelled work requested another paid model result');
    assert.deepEqual(await readConsoleMessages(owner), conversation, 'Cancellation implicitly published a message');
  } catch (cause) {
    failures.push(cause);
    await owner.stack
      .captureFailure('cancellationSurvivesEnvironmentOutage:before-sandbox-cleanup')
      .catch(() => undefined);
  } finally {
    model.release({ marker, index: 0 });
    resources.cancellationGate?.release();
    gate.release();
    await gate.close().catch((cause: unknown) => failures.push(cause));

    if (isOutageConfigured) {
      await owner.stack
        .restart({ environment: { MECHANE_SANDBOX_ORIGIN: environmentOrigin } })
        .catch((cause: unknown) => failures.push(cause));
    }

    await deleteSandbox(owner).catch((cause: unknown) => failures.push(cause));
    await resources.cancellationGate?.close().catch((cause: unknown) => failures.push(cause));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Cancellation recovery or its sandbox cleanup failed');
  }
}
