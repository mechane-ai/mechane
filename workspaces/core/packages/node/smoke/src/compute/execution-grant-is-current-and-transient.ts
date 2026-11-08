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
  sendInbox,
  turnPath,
  waitForBashCompletion,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Duration, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const COMMAND_SECONDS = 6;
const MILLISECONDS_PER_SECOND = 1000;
const CREDENTIAL_BYTES = 32;
const COMMAND_FAILURE_EXIT_CODE = 127;
const COMMAND_PADDING_CHARACTERS = 1500;
const OUTPUT_PADDING_COLUMNS = 9000;
const TRACE_READ_TIMEOUT_MS = 10_000;
const TRACE_INACCESSIBLE_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.Forbidden, HttpStatusCode.NotFound]);

export async function executionGrantIsCurrentAndTransient({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `execution-access-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);
  const secret = `execution-canary-${randomBytes(CREDENTIAL_BYTES).toString('hex')}`;
  const reference = `execution-${randomUUID()}`;
  const file = join(account.configurationRoot, reference);
  const hostReference = `host-request-${randomUUID()}`;
  const hostFile = join(account.configurationRoot, hostReference);
  const appReference = `github-app-${randomUUID()}`;
  const appFile = join(account.configurationRoot, appReference);
  const owner = { stack, account, mechId: mech.id };

  await writeFile(file, secret, { mode: 0o600 });
  await writeFile(hostFile, fixtures.nexus.apiKey, { mode: 0o600 });
  await writeFile(appFile, fixtures.github.app.privateKey, { mode: 0o600 });

  try {
    await runCli({
      stack,
      account,
      args: ['credential', 'put', reference, '--file', file, '--workspace', account.workspaceId],
      schema: CredentialMetadata,
    });
    await runCli({
      stack,
      account,
      args: ['credential', 'put', hostReference, '--file', hostFile, '--workspace', account.workspaceId],
      schema: CredentialMetadata,
    });
    await runCli({
      stack,
      account,
      args: ['credential', 'put', appReference, '--file', appFile, '--workspace', account.workspaceId],
      schema: CredentialMetadata,
    });
  } finally {
    await Promise.all([unlink(file), unlink(hostFile), unlink(appFile)]);
  }

  const access = {
    github: {
      app_id: fixtures.github.app.id,
      installation_id: fixtures.github.app.installationId,
      repository_id: fixtures.github.app.repositoryId,
      owner: 'mechane-smoke',
      repository: 'fixture',
      secret_reference: appReference,
    },
    variables: { SMOKE_SETTING: 'current' },
    secrets: { SMOKE_SECRET: reference },
    request_service: {
      service_id: fixtures.nexus.serviceId,
      url: fixtures.nexus.origin.href,
      secret_reference: hostReference,
    },
  };

  await runCli({
    stack,
    account,
    args: ['execution-access', 'set', mech.id, '--access', JSON.stringify(access), '--workspace', account.workspaceId],
    schema: ExecutionAccessState,
  });

  const toolCallId = randomUUID();

  const command = [
    'test -n "$SMOKE_SECRET" || exit 1',
    'test -n "$GH_TOKEN" || exit 1',
    "if env | grep -q 'fixture-nexus-'; then exit 1; fi",
    `sleep ${COMMAND_SECONDS}`,
    `printf '%${OUTPUT_PADDING_COLUMNS}s' ''`,
    String.raw`printf "setting=%s\n" "$SMOKE_SETTING"`,
    String.raw`printf "secret=%s\n" "$SMOKE_SECRET"`,
    String.raw`printf "injected=yes\n"`,
    String.raw`printf "host-key=absent\n"`,
    String.raw`printf "github=%s\n" "$GH_TOKEN"`,
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

  const sent = await sendInbox({ ...owner, text: marker });
  const result = await readBashResult({ model: fixtures.model, marker, toolCallId });
  const turn = await waitForTurn({ ...owner, inboxItemId: sent.id });

  const output = Schema.decodeUnknownSync(Schema.String)(result.output);

  assert.equal(turn.status, TurnStatus.Answered);
  assert.equal(result.status, 'completed');
  assert.equal(output.includes('setting=current\n'), true);
  assert.equal(output.includes('injected=yes\n'), true);
  assert.equal(output.includes('host-key=absent\n'), true);
  assert.equal(output.includes(secret), false, 'The shell result exposed its injected credential');
  assert.equal(result.exitCode, COMMAND_FAILURE_EXIT_CODE);

  const trace = await readTrace({ ...owner, turnId: turn.id });
  const tool = trace.toolCalls?.find((call) => call.id === toolCallId);

  assert.equal(tool?.status, ToolCallStatus.Completed, 'A shell failure must remain distinct from SDK completion');
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

  const tokens = fixtures.github.app.readTokens();

  assert.equal(tokens.length, 1, 'The command minted more than one repository token');

  const token = tokens[0];

  assert.ok(token !== undefined);
  assert.deepEqual(token.repositoryIds, [fixtures.github.app.repositoryId]);
  assert.deepEqual(token.permissions, {
    contents: 'write',
    pull_requests: 'write',
    issues: 'write',
    actions: 'read',
    checks: 'read',
    metadata: 'read',
  });
  assert.ok(token.revokedAt !== null, 'The terminal command left its GitHub token active');
  assert.ok(
    token.revokedAt - token.issuedAt >= COMMAND_SECONDS * MILLISECONDS_PER_SECOND,
    'The command token was revoked while its command was still running',
  );

  await runCli({
    stack,
    account,
    args: ['execution-access', 'set', mech.id, '--access', 'null', '--workspace', account.workspaceId],
    schema: ExecutionAccessState,
  });

  const revokedMarker = `revoked-execution-access-${randomUUID()}`;
  const revokedToolId = randomUUID();

  fixtures.model.configure({
    marker: revokedMarker,
    replies: [
      {
        tools: [
          {
            id: revokedToolId,
            name: 'bash',
            input: {
              command: String.raw`test -z "$SMOKE_SECRET" && test -z "$SMOKE_SETTING" && test -z "$GH_TOKEN" && printf "revoked\n"`,
            },
          },
        ],
      },
      { text: 'The later command has no revoked environment' },
    ],
  });

  const revoked = await sendInbox({ ...owner, text: revokedMarker });

  const { result: revokedResult } = await waitForBashCompletion({
    ...owner,
    inboxItemId: revoked.id,
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

  const credentials = [secret, fixtures.nexus.apiKey, token.value, fixtures.github.app.privateKey];

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

  await assertSandboxHasNoCredential(join(stack.stateDirectory, 'sandbox'), representations);
}

async function assertSandboxHasNoCredential(directory: string, representations: ReadonlyArray<string>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const file = join(entry.parentPath, entry.name);
      const contents = await readFile(file);

      assert.equal(
        representations.some((value) => contents.includes(value)),
        false,
        'Sandbox persistence contains a resolved credential',
      );
    }
  }
}
