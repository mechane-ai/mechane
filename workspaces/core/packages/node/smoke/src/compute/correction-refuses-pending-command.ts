import { catalog, Event, EventType, Mech, ToolCallStatus, TurnStatus } from '@mechane/protocol';
import type { NativeTools } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  sandboxExecutionCancelPendingPath,
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
} from '@mechane/sandbox-wire';
import {
  mechPath,
  readBashResult,
  readEvents,
  readSandboxCompletion,
  readTrace,
  repeatSandboxCompletion,
  requireFixtures,
  runBash,
  runCli,
  sendNotification,
  startCommandGate,
  waitFor,
  waitForPendingExecution,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 15_000;
const TERMINAL_TOOL_STATES: ReadonlySet<ToolCallStatus> = new Set([ToolCallStatus.Completed, ToolCallStatus.Failed]);
const OfferedTools = Schema.Array(Schema.Struct({ function: Schema.Struct({ name: Schema.String }) }));
type NativeToolProfileInput = MechContext & { readonly nativeTools: Option.Option<NativeTools> };

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
  const revokedFile = `.revoked-${randomUUID()}`;
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

    const pendingId = await waitForPendingExecution({
      ...input,
      excludeExecutionId: blockerId,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

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

    const completion = await readSandboxCompletion({ ...input, executionId: pendingId });

    assert.ok(completion !== null);

    const acknowledged = await repeatSandboxCompletion({ ...input, receipt: completion });

    assert.ok(acknowledged.ok);

    const activity = await readEvents(input);

    assert.ok(
      !activity.events.some(
        (event) =>
          Schema.is(Event)(event) &&
          event.type === EventType.NotificationReceived &&
          event.source.eventId === pendingId,
      ),
      'An observed command refusal admitted another completion notification',
    );

    await updateNativeToolProfile({ ...input, nativeTools: Option.some(['bash']) });

    const profileMarker = `native-profile-${randomUUID()}`;
    const profileCallId = randomUUID();

    model.configure({
      marker: profileMarker,
      replies: [
        {
          isHeld: true,
          tools: [{ id: profileCallId, name: 'bash', input: { command: `printf forbidden > '${revokedFile}'` } }],
        },
        { text: 'The current native tool policy was observed' },
      ],
    });

    try {
      const profileNotice = await sendNotification({ ...input, text: profileMarker });
      const proposed = await model.waitForCall({ marker: profileMarker, index: 0 });
      const offered = Schema.decodeUnknownSync(OfferedTools)(proposed.body['tools']);

      assert.deepEqual(
        new Set(offered.map((offeredTool) => offeredTool.function.name)),
        new Set(['bash']),
        'The model received native tools outside its profile',
      );
      model.release({ marker: profileMarker, index: 0 });

      const profileExecutionId = await waitForPendingExecution({
        ...input,
        excludeExecutionId: pendingId,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      const profile = await updateNativeToolProfile({ ...input, nativeTools: Option.some([]) });

      assert.deepEqual(profile.nativeTools, Option.some([]));
      gate.release();

      const profileResult = await readBashResult({
        model,
        marker: profileMarker,
        toolCallId: profileCallId,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      assert.ok(
        profileResult.output.includes(`Execution ${profileExecutionId}: refused.`),
        `The native policy removal returned ${JSON.stringify(profileResult)}`,
      );

      const profileReconsideration = await model.waitForCall({ marker: profileMarker, index: 1 });
      const currentTools = Schema.decodeUnknownSync(OfferedTools)(profileReconsideration.body['tools'] ?? []);

      assert.deepEqual(currentTools, [], 'A removed native tool remained in the next model request');
      await waitForTurn({ ...input, notificationId: profileNotice.id });

      const refusedProfile = await request(sandboxExecutionPath(identity(profileExecutionId)), HttpMethod.Get);

      assert.equal(refusedProfile._tag, 'Unavailable', 'Removing native Bash left a dispatchable pending claim');

      const settled = await waitFor({
        name: 'the previously admitted command to finish after native permission removal',
        read: () => request(blockerPath, HttpMethod.Get),
        accept: (receipt) => receipt._tag === 'Exited',
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      assert.equal(settled._tag, 'Exited');
      assert.equal(settled.exitCode, 0);
      assert.deepEqual(await request(sandboxExecutionCancelPendingPath(identity(blockerId)), HttpMethod.Post), settled);
      assert.deepEqual(
        await readTrace({ ...input, turnId: turn.id }),
        trace,
        'Native permission removal rewrote an admitted tool receipt',
      );
    } finally {
      model.release({ marker: profileMarker, index: 0 });
      await updateNativeToolProfile({ ...input, nativeTools: Option.none() });
    }

    const checked = await runBash({
      ...input,
      command: `test ! -e '${staleFile}' && test ! -e '${revokedFile}' && printf current`,
    });

    assert.equal(checked.receipt.status, 'completed');
    assert.equal(checked.result.output, 'current');
    assert.equal(gate.readRequests().length, 1, 'Cancellation replayed the original dispatched command');
  } finally {
    gate.release();
    await gate.close();
  }
}

async function updateNativeToolProfile({ nativeTools, ...input }: NativeToolProfileInput): Promise<Mech> {
  const { stack, account, mechId } = input;

  const current = await runCli({
    ...input,
    args: ['mech', 'show', mechId, '--workspace', account.workspaceId],
    schema: Mech,
  });

  const body = Schema.encodeSync(catalog.updateMech.body)({ expectedRevision: current.revision, nativeTools });
  const path = nativeToolDefinitionPath(input);

  const response = await fetch(new URL(path, stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  assert.equal(response.status, HttpStatusCode.Ok);

  return Schema.decodeUnknownSync(Mech)(await response.json());
}

function nativeToolDefinitionPath(input: Pick<MechContext, 'account' | 'mechId'>): string {
  return `${mechPath(input)}/definition`;
}
