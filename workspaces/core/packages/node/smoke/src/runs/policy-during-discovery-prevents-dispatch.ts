import { Mech, ToolCallStatus, TurnStatus, WorkspacePolicy } from '@mechane/protocol';
import type { ModelFixture } from '@mechane/stack';
import {
  createAccount,
  readHistoryPage,
  readModelToolResult,
  readTrace,
  requireFixtures,
  runCli,
  runCliFailure,
  sendNotification,
  startHeldMcpInvocation,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { Account, McpFixture, MechContext } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

type PolicyDiscoveryInput = MechContext & {
  readonly fixture: McpFixture;
  readonly model: ModelFixture;
  readonly toolName: string;
};

type PolicyUpdate = MechContext & { readonly administrator: Account; readonly policy: WorkspacePolicy };
type ControlRefusal = Awaited<ReturnType<typeof runCliFailure>>;

const CONFIRMED_MODEL_CALLS = 2;
const TOOL_TERMINAL_STATUSES: ReadonlySet<ToolCallStatus> = new Set([ToolCallStatus.Completed, ToolCallStatus.Failed]);
const PolicyVeto = Schema.fromJsonString(Schema.Struct({ status: Schema.Literals(['refused', 'not_started']) }));
const decodeVeto = Schema.decodeUnknownResult(PolicyVeto);

const UnconfirmedControlChange = Schema.fromJsonString(
  Schema.Struct({
    errors: Schema.NonEmptyArray(
      Schema.Struct({
        code: Schema.Literal('ServiceUnavailable'),
        reason: Schema.Literal(
          'The configuration was saved, but its runtime refresh is unconfirmed. Read its current state before repeating the command.',
        ),
      }),
    ),
  }),
);

export async function policyDuringDiscoveryPreventsDispatch(input: PolicyDiscoveryInput): Promise<void> {
  const { stack, account, mechId, fixture, model, toolName } = input;
  const administrator = await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login });

  const policy = await runCli({
    stack,
    account: administrator,
    args: ['workspace', 'policy', 'show', account.workspaceId],
    schema: WorkspacePolicy,
  });

  const current = await readDefinition(input);

  const confirmedMarker = `confirmed-mcp-${randomUUID()}`;
  const confirmedCallId = randomUUID();

  model.configure({
    marker: confirmedMarker,
    replies: [
      { tools: [{ id: confirmedCallId, name: toolName, input: { requestID: randomUUID() } }] },
      { text: 'The confirmed receipt remains private.' },
    ],
  });

  const confirmedNotice = await sendNotification({ ...input, text: confirmedMarker });
  const confirmedTurn = await waitForTurn({ ...input, notificationId: confirmedNotice.id });

  assert.equal(confirmedTurn.status, TurnStatus.Completed);

  const confirmedResult = await readModelToolResult({ model, marker: confirmedMarker, toolCallId: confirmedCallId });
  const confirmedAddress = { ...input, turnId: confirmedTurn.id };
  const confirmedTrace = await readTrace(confirmedAddress);
  const history = await readHistoryPage(input);
  const receiptEntry = history.entries.find((entry) => entry.text.includes(JSON.stringify(confirmedResult)));

  assert.ok(receiptEntry !== undefined, 'The confirmed MCP result has no readable durable history');

  const committed = fixture.readCalls();

  assert.deepEqual(committed, [fixture.names.Write]);

  const marker = `policy-discovery-${randomUUID()}`;
  const { turn, toolCallId } = await startHeldMcpInvocation({ ...input, marker });
  const invocation = fixture.holdNextDiscovery();
  const refresh = fixture.holdNextDiscovery();
  const instructions = `Observe the current workspace policy ${randomUUID()}`;
  const failures: Array<unknown> = [];
  let shouldRestorePolicy = false;
  let updating: Promise<ReadonlyArray<PromiseSettledResult<ControlRefusal>>> = Promise.resolve([]);
  let pausing: Promise<ReadonlyArray<PromiseSettledResult<ControlRefusal>>> = Promise.resolve([]);

  try {
    model.release({ marker, index: 0 });
    await invocation.waitForRequest();

    const address = { ...input, turnId: turn.id };
    const admitted = await readTrace(address);

    assert.equal(admitted.toolCalls?.find((call) => call.id === toolCallId)?.status, ToolCallStatus.Running);

    updating = Promise.allSettled([
      runCliFailure({
        ...input,
        args: [
          'mech',
          'update',
          mechId,
          '--workspace',
          account.workspaceId,
          '--expected-revision',
          String(current.revision),
          '--instructions',
          instructions,
        ],
      }),
    ]);

    await refresh.waitForRequest();

    shouldRestorePolicy = true;

    pausing = Promise.allSettled([
      runCliFailure(policyCommand({ ...input, administrator, policy: { ...policy, isSuspended: true } })),
    ]);

    const [updated, suspension] = await Promise.all([updating, pausing]);

    assertUnconfirmed(updated[0]);
    assertUnconfirmed(suspension[0]);

    const saved = await readDefinition(input);

    const paused = await runCli({
      stack,
      account: administrator,
      args: ['workspace', 'policy', 'show', account.workspaceId],
      schema: WorkspacePolicy,
    });

    assert.equal(saved.revision, current.revision + 1);
    assert.deepEqual(saved.instructions, Option.some(instructions));
    assert.deepEqual(saved.activeRevision, Option.some(current.revision));
    assert.equal(paused.isSuspended, true);
    invocation.release();

    await waitFor({
      name: 'the policy-fenced MCP invocation to finish without remote dispatch',
      read: () => readTrace(address),
      accept: (trace) =>
        trace.toolCalls?.some((call) => call.id === toolCallId && TOOL_TERMINAL_STATUSES.has(call.status)) ?? false,
    });
    assert.deepEqual(fixture.readCalls(), committed, 'Workspace suspension during discovery allowed a remote write');
    assert.equal(model.readCalls({ marker }).length, 1, 'The suspended workspace dispatched another provider request');

    const pausedHistory = await readHistoryPage(input);
    const priorEntries = new Set(history.entries.map((entry) => entry.id));

    const veto = pausedHistory.entries.some((entry) => {
      const decoded = decodeVeto(entry.text.split('\n')[0] ?? '');

      return !priorEntries.has(entry.id) && decoded._tag === 'Success';
    });

    assert.equal(veto, true, 'The late policy fence did not retain a typed refusal');
    refresh.release();

    const renamed = await runCli({
      ...input,
      args: [
        'mech',
        'rename',
        mechId,
        '--workspace',
        account.workspaceId,
        '--expected-revision',
        String(saved.revision),
        '--name',
        `Recovered control ${randomUUID()}`,
      ],
      schema: Mech,
    });

    assert.equal(renamed.revision, saved.revision + 1);
    assert.deepEqual((await readDefinition(input)).activeRevision, Option.some(renamed.revision));
    await stack.restart({ signal: 'SIGKILL' });

    const replayed = await readHistoryPage(input);

    assert.deepEqual(await readTrace(confirmedAddress), confirmedTrace);
    assert.deepEqual(
      replayed.entries.find((entry) => entry.id === receiptEntry.id),
      receiptEntry,
    );
    assert.deepEqual(fixture.readCalls(), committed, 'Paused replay repeated a confirmed MCP effect');
    assert.equal(model.readCalls({ marker: confirmedMarker }).length, CONFIRMED_MODEL_CALLS);
    assert.equal(model.readCalls({ marker }).length, 1);
  } catch (cause) {
    failures.push(cause);
    await stack
      .captureFailure('policy-discovery-before-restoration')
      .catch((failure: unknown) => failures.push(failure));
  } finally {
    model.release({ marker, index: 0 });
    invocation.release();
    refresh.release();

    await updating;
    await pausing;

    if (shouldRestorePolicy) {
      await runCli({ ...policyCommand({ ...input, administrator, policy }), schema: WorkspacePolicy }).catch(
        (cause: unknown) => failures.push(cause),
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The late workspace-policy fence or restoration failed');
  }
}

function assertUnconfirmed(result: PromiseSettledResult<ControlRefusal> | undefined): void {
  assert.ok(result !== undefined);

  if (result.status === 'rejected') {
    throw result.reason;
  }

  Schema.decodeUnknownSync(UnconfirmedControlChange)(result.value.stdout);
}

async function readDefinition(input: MechContext): Promise<Mech> {
  return await runCli({
    ...input,
    args: ['mech', 'show', input.mechId, '--workspace', input.account.workspaceId],
    schema: Mech,
  });
}

function policyCommand({ stack, account, administrator, policy }: PolicyUpdate): Parameters<typeof runCliFailure>[0] {
  return {
    stack,
    account: administrator,
    args: [
      'workspace',
      'policy',
      'set',
      account.workspaceId,
      '--suspended',
      String(policy.isSuspended),
      '--sandboxes',
      String(policy.hasSandboxes),
      '--machines',
      String(policy.machines),
      '--daily-allowance-micros',
      String(policy.dailyAllowanceMicros),
    ],
  };
}
