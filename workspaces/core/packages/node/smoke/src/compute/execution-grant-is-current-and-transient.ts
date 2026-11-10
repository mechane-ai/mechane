import {
  CredentialMetadata,
  ExecutionAccessState,
  TOOL_TRACE_COMMAND_MAX_BYTES,
  TOOL_TRACE_OUTPUT_MAX_BYTES,
  ToolCallStatus,
  TurnStatus,
} from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  readBashResult,
  readTrace,
  requireFixtures,
  runCli,
  sendNotification,
  turnPath,
  waitForBashCompletion,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Duration, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { remoteToolGrantsHonorPolicy } from './remote-tool-grants-honor-policy.ts';

const CREDENTIAL_BYTES = 32;
const COMMAND_FAILURE_EXIT_CODE = 127;
const COMMAND_PADDING_CHARACTERS = 1500;
const OUTPUT_PADDING_COLUMNS = 9000;
const TRACE_READ_TIMEOUT_MS = 10_000;
const TRACE_INACCESSIBLE_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.Forbidden, HttpStatusCode.NotFound]);

type SandboxCredentialInput = {
  readonly sandbox: NonNullable<ScenarioInput['stack']['sandbox']>;
  readonly representations: ReadonlyArray<string>;
};

export async function executionGrantIsCurrentAndTransient({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `execution-access-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);
  const secret = `execution-canary-${randomBytes(CREDENTIAL_BYTES).toString('hex')}`;
  const reference = `execution-${randomUUID()}`;
  const file = join(account.configurationRoot, reference);
  const owner = { stack, account, mechId: mech.id };

  await writeFile(file, secret, { mode: 0o600 });

  try {
    await runCli({
      stack,
      account,
      args: ['credential', 'put', reference, '--file', file, '--workspace', account.workspaceId],
      schema: CredentialMetadata,
    });
  } finally {
    await unlink(file);
  }

  const access = { variables: { SMOKE_SETTING: 'current' }, secrets: { SMOKE_SECRET: reference } };

  await runCli({
    stack,
    account,
    args: ['execution-access', 'set', mech.id, '--access', JSON.stringify(access), '--workspace', account.workspaceId],
    schema: ExecutionAccessState,
  });

  const toolCallId = randomUUID();

  const command = [
    'test -n "$SMOKE_SECRET" || exit 1',
    `printf '%${OUTPUT_PADDING_COLUMNS}s' ''`,
    String.raw`printf "setting=%s\n" "$SMOKE_SETTING"`,
    String.raw`printf "secret=%s\n" "$SMOKE_SECRET"`,
    String.raw`printf "injected=yes\n"`,
    `# ${'界'.repeat(COMMAND_PADDING_CHARACTERS)}`,
    `exit ${COMMAND_FAILURE_EXIT_CODE}`,
  ].join('\n');

  fixtures.model.configure({
    marker,
    replies: [
      { tools: [{ id: toolCallId, name: 'bash', input: { command } }] },
      { text: 'The configured command finished' },
    ],
  });

  const sent = await sendNotification({ ...owner, text: marker });
  const result = await readBashResult({ model: fixtures.model, marker, toolCallId });
  const turn = await waitForTurn({ ...owner, notificationId: sent.id });

  const output = Schema.decodeUnknownSync(Schema.String)(result.output);

  assert.equal(turn.status, TurnStatus.Completed);
  assert.equal(result.status, 'completed');
  assert.equal(output.includes('setting=current\n'), true);
  assert.equal(output.includes('injected=yes\n'), true);
  assert.equal(output.includes(secret), false, 'The shell result exposed its injected credential');
  assert.equal(result.exitCode, COMMAND_FAILURE_EXIT_CODE);

  const trace = await readTrace({ ...owner, turnId: turn.id });
  const tool = trace.toolCalls?.find((call) => call.id === toolCallId);

  assert.equal(tool?.status, ToolCallStatus.Failed, 'The native tool did not preserve its failed shell exit');
  assert.ok(tool.inspection !== undefined);

  const inspectedCommand = Option.getOrThrow(tool.inspection.command);
  const inspectedResult = Option.getOrThrow(tool.inspection.result);
  const inspectedOutput = Option.getOrThrow(inspectedResult.output);

  assert.ok(inspectedCommand.text.includes('test -n "$SMOKE_SECRET"'));
  assert.ok(Buffer.byteLength(inspectedCommand.text) <= TOOL_TRACE_COMMAND_MAX_BYTES);
  assert.ok(inspectedCommand.omittedBytes > 0, 'A shortened command did not declare omitted bytes');
  assert.equal(inspectedResult.status, 'completed');
  assert.equal(Option.getOrThrow(inspectedResult.exitCode), COMMAND_FAILURE_EXIT_CODE);
  assert.ok(Duration.isPositive(Option.getOrThrow(inspectedResult.duration)));
  assert.ok(inspectedOutput.text.includes('setting=current\n'));
  assert.ok(inspectedOutput.text.includes('secret=[redacted]\n'));
  assert.ok(Buffer.byteLength(inspectedOutput.text) <= TOOL_TRACE_OUTPUT_MAX_BYTES);
  assert.ok(inspectedOutput.omittedBytes > 0, 'A shortened output did not declare omitted bytes');

  const revokedMarker = `revoked-execution-access-${randomUUID()}`;
  const revokedToolId = randomUUID();

  fixtures.model.configure({
    marker: revokedMarker,
    replies: [
      {
        isHeld: true,
        tools: [
          {
            id: revokedToolId,
            name: 'bash',
            input: { command: String.raw`test -z "$SMOKE_SECRET" && test -z "$SMOKE_SETTING" && printf "revoked\n"` },
          },
        ],
      },
      { text: 'The later command has no revoked environment' },
    ],
  });

  const revoked = await sendNotification({ ...owner, text: revokedMarker });

  await fixtures.model.waitForCall({ marker: revokedMarker, index: 0 });

  try {
    await runCli({
      stack,
      account,
      args: ['execution-access', 'set', mech.id, '--access', 'null', '--workspace', account.workspaceId],
      schema: ExecutionAccessState,
    });
  } finally {
    fixtures.model.release({ marker: revokedMarker, index: 0 });
  }

  const { result: revokedResult } = await waitForBashCompletion({
    ...owner,
    notificationId: revoked.id,
    marker: revokedMarker,
    toolCallId: revokedToolId,
  });

  assert.equal(revokedResult.output, 'revoked\n');

  const other = await createAccount({ stack, login: fixtures.github.users.owner.login });
  const path = turnPath({ ...owner, turnId: turn.id });

  const denied = await fetch(new URL(path, stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${other.token}` },
    signal: AbortSignal.timeout(TRACE_READ_TIMEOUT_MS),
  });

  assert.ok(TRACE_INACCESSIBLE_STATUSES.has(denied.status));

  const [database, log] = await Promise.all([stack.dumpStorage(), readFile(stack.serverLog, 'utf8')]);

  const surfaces = [
    database,
    log,
    JSON.stringify(trace),
    JSON.stringify(fixtures.model.readCalls({ marker }).map((call) => call.body)),
  ];

  const credentials = [secret];

  const representations = credentials.flatMap((credential) => [
    credential,
    Buffer.from(credential).toString('hex'),
    Buffer.from(credential).toString('base64'),
  ]);

  for (const value of representations) {
    assert.equal(
      surfaces.some((surface) => surface.includes(value)),
      false,
      'Execution serialized a resolved credential',
    );
  }

  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  await assertSandboxHasNoCredential({ sandbox, representations });
  await remoteToolGrantsHonorPolicy({ stack });
}

async function assertSandboxHasNoCredential({ sandbox, representations }: SandboxCredentialInput): Promise<void> {
  for await (const contents of sandbox.persistedFiles()) {
    assert.equal(
      representations.some((value) => contents.includes(value)),
      false,
      'Sandbox persistence contains a resolved credential',
    );
  }
}
