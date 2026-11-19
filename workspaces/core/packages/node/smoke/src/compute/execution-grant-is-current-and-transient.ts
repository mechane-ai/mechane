import { CredentialDeletion, CredentialMetadata, ExecutionAccessState, WorkspaceList } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { installedCommandEnvironmentPath, ProcessObservation } from '@mechane/sandbox-wire';
import {
  closeInstalledContext,
  createInstalledContext,
  installedComputerResourcePath,
  readInstalledComputer,
  requireFixtures,
  runCli,
  runCliFailure,
  runInstalledBash,
  startInstalledProcess,
  waitForInstalledCompletion,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SECRET_BYTES = 32;

export async function executionGrantIsCurrentAndTransient({ stack }: ScenarioInput): Promise<void> {
  const marker = `execution-access-${randomUUID()}`;
  const context = await createInstalledContext({ stack, name: marker });
  const { account, agent, client, session } = context;
  const listed = await runCli({ stack, account, args: ['workspace', 'list'], schema: WorkspaceList });
  const workspace = listed.workspaces.find((candidate) => candidate.name === 'Softmax');

  assert.ok(workspace !== undefined, 'The fixture owner must belong to the installation workspace');

  const secretReference = `execution-${randomUUID()}`;
  const privateFile = join(account.configurationRoot, secretReference);

  const workspaceId = workspace.id;
  const identity = `context=${workspaceId}/${agent.id}/${session.id}`;
  const printIdentity = String.raw`printf 'context=%s/%s/%s\n' "$MECHANE_WORKSPACE_ID" "$MECHANE_AGENT_ID" "$MECHANE_SESSION_ID"`;
  const target = [agent.id, account.principalId, '--workspace', workspaceId];
  const access = { variables: { SMOKE_SETTING: 'current' }, secrets: { SMOKE_SECRET: secretReference } };
  const rotatedSecret = randomBytes(SECRET_BYTES).toString('hex');
  const secrets = [randomBytes(SECRET_BYTES).toString('hex'), rotatedSecret];
  let hasCredential = false;
  let hasBinding = false;

  async function revokeBinding(): Promise<void> {
    const revoked = await runCli({
      stack,
      account,
      schema: ExecutionAccessState,
      args: ['execution-access', 'revoke', ...target],
    });

    assert.ok(Option.isNone(revoked.access));

    hasBinding = false;
  }

  async function saveSecret(secret: string): Promise<void> {
    await writeFile(privateFile, secret, { mode: 0o600 });

    try {
      await runCli({
        stack,
        account,
        schema: CredentialMetadata,
        args: ['credential', 'put', secretReference, '--file', privateFile, '--workspace', workspaceId],
      });
    } finally {
      await rm(privateFile, { force: true });
    }
  }

  const command = [
    printIdentity,
    'test "$SMOKE_SETTING" = current && test -n "$SMOKE_SECRET" || exit 1',
    'printf %s "$SMOKE_SECRET" | sha256sum',
    String.raw`printf "stdout=%s\n" "$SMOKE_SECRET"`,
    String.raw`printf "stderr=%s\n" "$SMOKE_SECRET" >&2`,
  ].join('\n');

  try {
    for (const field of ['variables', 'secrets']) {
      const collision = { ...access, [field]: { MECHANE_SESSION_ID: secretReference } };

      const refused = await runCliFailure({
        stack,
        account,
        args: ['execution-access', 'set', ...target, '--access', JSON.stringify(collision)],
      });

      assert.match(refused.stdout, /MECHANE_SESSION_ID/u);
    }

    for (const [index, secret] of secrets.entries()) {
      await saveSecret(secret);

      hasCredential = true;

      if (index === 0) {
        const saved = await runCli({
          stack,
          account,
          schema: ExecutionAccessState,
          args: ['execution-access', 'set', ...target, '--access', JSON.stringify(access)],
        });

        hasBinding = true;

        assert.deepEqual(Option.getOrThrow(saved.access), access);
      }

      const digest = createHash('sha256').update(secret).digest('hex');
      const output = await runInstalledBash(context, { command });

      assert.ok(output.split('\n').includes(identity), 'Bash must identify the session that owns this work');
      assert.ok(output.includes(digest), 'The shell did not use the current secret');
      assert.ok(output.includes('stdout=') && output.includes('stderr='));
      assert.ok(
        secrets.every((value) => !output.includes(value)),
        'The tool result contained a granted secret',
      );
    }

    const shown = await runCli({
      stack,
      account,
      schema: ExecutionAccessState,
      args: ['execution-access', 'show', ...target],
    });

    assert.deepEqual(Option.getOrThrow(shown.access), access);

    const processId = randomUUID();
    const processDigest = createHash('sha256').update(rotatedSecret).digest('hex');

    await startInstalledProcess(context, {
      processId,
      command: [
        printIdentity,
        'test "$SMOKE_SETTING" = current || exit 1',
        `printf %s "$SMOKE_SECRET" | sha256sum | grep -Fq '${processDigest}' || exit 1`,
        'printf %s "$SMOKE_SECRET" >&2',
      ].join('\n'),
    });

    const completion = await waitForInstalledCompletion(context, processId);

    assert.equal(completion.status, 'exited');
    assert.equal(Option.getOrThrow(completion.exitCode), 0, 'The process did not receive the rotated grant');

    const observation = await readInstalledComputer(context, ProcessObservation, {
      path: installedComputerResourcePath({ collection: 'processes', id: processId }),
    });

    assert.ok(observation.output.text.split('\n').includes(identity), 'The process must identify its owning session');
    assert.ok(!observation.output.text.includes(rotatedSecret), 'The process log included a granted secret');

    await revokeBinding();

    const revoked = await runInstalledBash(context, {
      command: `test -z "$SMOKE_SECRET$SMOKE_SETTING" && ${printIdentity}`,
    });

    assert.equal(revoked.trim(), identity, 'Revocation must remove the grant and preserve session attribution');

    const ownerAttempt = await fetch(
      new URL(installedCommandEnvironmentPath({ sessionId: session.id }), stack.origin),
      { headers: { [HttpHeader.Authorization]: `Bearer ${account.token}` } },
    );

    assert.equal(ownerAttempt.status, HttpStatusCode.Unauthorized, 'The worker endpoint accepted an owner credential');

    const surfaces = [
      await stack.dumpStorage(),
      await readFile(stack.serverLog, 'utf8'),
      JSON.stringify(requireFixtures(stack).model.readCalls()),
    ];

    for await (const event of client.beta.sessions.events.list(session.id)) {
      surfaces.push(JSON.stringify(event));
    }

    const sandbox = stack.sandbox;

    assert.ok(sandbox !== undefined);

    const representations = secrets.flatMap((value) => [
      value,
      Buffer.from(value).toString('hex'),
      Buffer.from(value).toString('base64'),
    ]);

    for await (const bytes of sandbox.persistedFiles()) {
      assert.ok(
        representations.every((value) => !bytes.includes(value)),
        'The sandbox persisted a credential',
      );
    }

    assert.ok(
      representations.every((value) => surfaces.every((surface) => !surface.includes(value))),
      'A resolved credential appeared in persisted records or logs',
    );
  } finally {
    try {
      if (hasBinding) {
        await revokeBinding();
      }

      if (hasCredential) {
        await runCli({
          stack,
          account,
          schema: CredentialDeletion,
          args: ['credential', 'delete', secretReference, '--workspace', workspaceId],
        });
      }
    } finally {
      await closeInstalledContext(context);
    }
  }
}
