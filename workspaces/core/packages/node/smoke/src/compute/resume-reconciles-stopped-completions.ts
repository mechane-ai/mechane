import { Event, EventType, MECH_MAINTENANCE_PATH } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import {
  SandboxCompletionReceipt,
  sandboxPendingCompletionsPath,
  SandboxServiceIdentity,
  SandboxStopPhase,
} from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import {
  createAccount,
  createMech,
  deleteSandbox,
  readEvents,
  readModelToolResult,
  readSandboxCompletion,
  repeatSandboxCompletion,
  requestSandboxStop,
  requireFixtures,
  sendNotification,
  startCommandGate,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 30_000;
const StartedProcess = Schema.Struct({ status: Schema.Literal('running'), processId: Schema.String });

const STOP_TERMINAL_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Failed,
]);

async function maintenanceRequest(input: MechContext, action: 'quiesce' | 'resume'): Promise<Response> {
  const sandbox = input.stack.sandbox;

  if (sandbox === undefined) {
    throw new Error('The scenario requires the sandbox service');
  }

  return await fetch(new URL(MECH_MAINTENANCE_PATH, input.stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${sandbox.bearer}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ workspaceId: input.account.workspaceId, mechId: input.mechId, action }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function maintenance(input: MechContext, action: 'quiesce' | 'resume'): Promise<void> {
  const response = await maintenanceRequest(input, action);

  assert.ok(response.ok, `Maintenance ${action} returned ${response.status}`);
}

async function sandboxStop(input: MechContext): Promise<void> {
  const requested = await requestSandboxStop(input);

  const stopped = await waitFor({
    name: 'the old environment stop',
    read: () => requestSandboxStop({ ...input, operationId: requested.operationId }),
    accept: (receipt) => STOP_TERMINAL_PHASES.has(receipt.phase),
  });

  assert.equal(stopped.phase, SandboxStopPhase.Completed);
}

export async function resumeReconcilesStoppedCompletions({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `resume-completion-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const { model } = requireFixtures(stack);
  const gate = await startCommandGate({ stack });
  const toolCallId = randomUUID();

  try {
    model.configure({
      marker,
      replies: [
        {
          tools: [{ id: toolCallId, name: 'start_process', input: { command: `curl --fail --silent '${gate.url}'` } }],
        },
        { text: 'The process can finish later' },
      ],
    });

    const sent = await sendNotification({ ...owner, text: marker });
    const process = Schema.decodeUnknownSync(StartedProcess)(await readModelToolResult({ model, marker, toolCallId }));

    await waitForTurn({ ...owner, notificationId: sent.id });
    await gate.waitForRequest({ count: 1 });
    await maintenance(owner, 'quiesce');
    await sandboxStop(owner);

    const receipt = await waitFor({
      name: 'the stopped process completion',
      read: () => readSandboxCompletion({ ...owner, executionId: process.processId }),
      accept: (value) => value !== null,
    });

    assert.ok(receipt !== null);
    assert.equal(receipt.status, 'lost');

    const refusedCallback = await repeatSandboxCompletion({ ...owner, receipt });

    assert.equal(refusedCallback.ok, false);
    model.configure({ marker: process.processId, replies: [{ text: 'The stopped process was observed' }] });

    const sandbox = stack.sandbox;

    assert.ok(sandbox !== undefined);

    const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)({
      workspaceId: account.workspaceId,
      mechId: mech.id,
    });

    const forged = Schema.encodeSync(SandboxCompletionReceipt)({ ...receipt, exitCode: Option.some(1) });

    const rejected = await fetch(new URL(sandboxPendingCompletionsPath(identity), sandbox.origin), {
      method: HttpMethod.Post,
      headers: { [HttpHeader.Authorization]: `Bearer ${sandbox.bearer}`, [HttpHeader.ContentType]: MediaType.Json },
      body: JSON.stringify(forged),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    assert.equal(rejected.ok, false, 'A mismatched acknowledgment discarded the retained receipt');

    await sandbox.restart({
      signal: 'SIGKILL',
      whileStopped: async () => {
        const failed = await maintenanceRequest(owner, 'resume');

        assert.equal(failed.ok, false, 'Resume succeeded while its completion owner was unavailable');
        await assert.rejects(sendNotification({ ...owner, text: `still-quiesced-${randomUUID()}` }));

        const events = await readEvents(owner);

        assert.equal(
          events.events.some(
            (event) =>
              Schema.is(Event)(event) &&
              event.type === EventType.NotificationReceived &&
              event.source.eventId === process.processId,
          ),
          false,
        );
      },
    });

    const events = await waitFor({
      name: 'the retained completion after the environment owner recovered',
      read: () => readEvents(owner),
      accept: (page) =>
        page.events.some(
          (event) =>
            Schema.is(Event)(event) &&
            event.type === EventType.NotificationReceived &&
            event.source.eventId === process.processId,
        ),
    });

    const delivered = events.events.filter(
      (event) =>
        Schema.is(Event)(event) &&
        event.type === EventType.NotificationReceived &&
        event.source.eventId === process.processId,
    );

    assert.equal(delivered.length, 1, 'Resume returned before reconciling the stopped process completion');

    const observed = await model.waitForCall({ marker: process.processId, index: 0 });

    assert.ok(
      JSON.stringify(observed.body).includes(process.processId),
      'The resumed model did not observe the completion',
    );

    const replayed = await repeatSandboxCompletion({ ...owner, receipt });

    assert.ok(replayed.ok);

    const afterReplay = await readEvents(owner);

    assert.equal(
      afterReplay.events.filter(
        (event) =>
          Schema.is(Event)(event) &&
          event.type === EventType.NotificationReceived &&
          event.source.eventId === process.processId,
      ).length,
      1,
      'Replaying the completion admitted it twice',
    );
  } finally {
    gate.release();
    await gate.close();
    await deleteSandbox(owner);
  }
}
