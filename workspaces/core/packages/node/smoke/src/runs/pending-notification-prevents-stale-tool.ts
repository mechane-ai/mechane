import { RemoteToolPolicy, ToolCallStatus, TurnStatus } from '@mechane/protocol';
import {
  createMechContext,
  discoverMcpTools,
  findOfferedMcpTool,
  grantMcpTools,
  readConsoleMessages,
  readModelToolResult,
  readSandboxMachines,
  readTrace,
  readTurns,
  requireFixtures,
  sendNotification,
  startHeldMcpInvocation,
  startMcpFixture,
  waitForTurn,
  withMcpConnection,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { policyDuringDiscoveryPreventsDispatch } from './policy-during-discovery-prevents-dispatch.ts';

const LateToolVeto = Schema.Struct({ status: Schema.Literals(['not_started', 'refused']) });

export async function pendingNotificationPreventsStaleTool({ stack }: ScenarioInput): Promise<void> {
  const marker = `correction-${randomUUID()}`;
  const staleText = `stale-${randomUUID()}`;
  const correctedText = `corrected-${randomUUID()}`;
  const staleCallId = randomUUID();
  const browserCallId = randomUUID();
  const owner = await createMechContext({ stack, name: marker });
  const { model } = requireFixtures(stack);
  const machines = await readSandboxMachines(stack);

  model.configure({
    marker,
    replies: [
      {
        isHeld: true,
        tools: [
          { id: staleCallId, name: 'console_message', input: { text: staleText } },
          { id: browserCallId, name: 'browser_open', input: { url: 'about:blank' } },
        ],
      },
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: correctedText } }] },
      { text: `private-${randomUUID()}` },
    ],
  });

  const original = await sendNotification({ ...owner, text: marker });

  await model.waitForCall({ marker, index: 0 });

  const correction = await sendNotification({ ...owner, text: `${marker}: use ${correctedText}` }).finally(() => {
    model.release({ marker, index: 0 });
  });

  const reconsideration = await model.waitForCall({ marker, index: 1 });
  const messages = reconsideration.body['messages'];

  const result = await readModelToolResult({ model, marker, toolCallId: staleCallId });
  const browserResult = await readModelToolResult({ model, marker, toolCallId: browserCallId });

  assert.deepEqual(result, { status: 'not_started', reason: 'notifications_pending' });
  assert.deepEqual(browserResult, result, 'The browser renderer could not represent a vetoed tool');
  assert.deepEqual(await readSandboxMachines(stack), machines, 'A stale browser call allocated a computer');
  assert.ok(JSON.stringify(messages).includes(correction.id), 'The reconsideration omitted the accepted correction');

  const completed = await waitForTurn({ ...owner, notificationId: correction.id });
  const runs = await readTurns(owner);
  const conversation = await readConsoleMessages(owner);

  assert.equal(completed.status, TurnStatus.Completed);
  assert.equal(runs.length, 1, 'An active notification started another owner');
  assert.ok(completed.notificationIds.includes(original.id));
  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [correctedText],
  );

  await correctionDuringDiscoveryPreventsDispatch(owner);
}

async function correctionDuringDiscoveryPreventsDispatch(owner: MechContext): Promise<void> {
  const fixture = await startMcpFixture();
  const { model } = requireFixtures(owner.stack);

  await withMcpConnection({
    ...owner,
    fixture,
    policy: RemoteToolPolicy.IdempotentFree,
    use: async (connection) => {
      await grantMcpTools({ ...owner, fixture, connectionId: connection.id });

      const offered = await discoverMcpTools({ ...owner, model, marker: `late-discovery-tools-${randomUUID()}` });
      const toolName = findOfferedMcpTool({ tools: offered, description: fixture.descriptions.write });

      assert.ok(toolName !== undefined);

      const marker = `late-discovery-${randomUUID()}`;
      const { turn, toolCallId } = await startHeldMcpInvocation({ ...owner, marker, model, toolName });
      const discovery = fixture.holdNextDiscovery();

      try {
        model.release({ marker, index: 0 });
        await discovery.waitForRequest();

        const admitted = await readTrace({ ...owner, turnId: turn.id });
        const tool = admitted.toolCalls?.find((candidate) => candidate.id === toolCallId);

        assert.equal(tool?.status, ToolCallStatus.Running, 'The HTTP gate did not pause after generic tool admission');

        const correction = await sendNotification({ ...owner, text: `${marker}: do not perform the pending write` });

        discovery.release();

        const result = await readModelToolResult({ model, marker, toolCallId });

        assert.deepEqual(fixture.readCalls(), [], 'A correction accepted during discovery allowed a remote write');
        assert.ok(Schema.is(LateToolVeto)(result), 'The late dispatch fence did not return a typed refusal');

        const completed = await waitForTurn({ ...owner, notificationId: correction.id });
        const reconsideration = await model.waitForCall({ marker, index: 1 });

        assert.equal(completed.status, TurnStatus.Completed);
        assert.ok(JSON.stringify(reconsideration.body['messages']).includes(correction.id));
      } finally {
        model.release({ marker, index: 0 });
        discovery.release();
      }

      await policyDuringDiscoveryPreventsDispatch({ ...owner, fixture, model, toolName });
    },
  });
}
