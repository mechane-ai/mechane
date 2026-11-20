import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { sessionsTokenFromSecret } from '@anthropic-ai/sdk/lib/environments/worker';
import { BetaHeartbeatPreconditionFailedError } from '@anthropic-ai/sdk/resources/beta/environments/work';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { createAccount, issueEnvironmentKey, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { recoverWorkerEffect, verifySuspendedWorker } from './recover-worker-effect.ts';

const DISPATCH_TIMEOUT_MS = 30_000;
const OVERSIZED_TTL_SECONDS = 900;
const CLAMPED_TTL_SECONDS = 300;

const inaccessible: ReadonlySet<number> = new Set([
  HttpStatusCode.Unauthorized,
  HttpStatusCode.Forbidden,
  HttpStatusCode.NotFound,
]);

function isInaccessible(error: unknown): boolean {
  return error instanceof APIError && typeof error.status === 'number' && inaccessible.has(error.status);
}

export async function scopedWorkerDeliversToolResult({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const owner = new Anthropic({ apiKey: account.token, baseURL: stack.origin.origin, maxRetries: 0 });
  const marker = randomUUID();
  const environment = await owner.beta.environments.create({ name: marker, config: { type: 'self_hosted' } });

  const agent = await owner.beta.agents.create({
    name: marker,
    model: 'claude-haiku-5-5',
    tools: [
      {
        type: 'agent_toolset_20260401',
        configs: [
          { type: 'write', name: 'write', permission_policy: { type: 'auto' } },
          { type: 'bash', name: 'bash', permission_policy: { type: 'always_allow' } },
        ],
      },
    ],
  });

  const create = { agent: agent.id, environment_id: environment.id };
  const session = await owner.beta.sessions.create(create);

  const environmentKey = await issueEnvironmentKey({
    origin: stack.origin,
    environmentId: environment.id,
    token: account.token,
  });

  const poller = new Anthropic({ authToken: environmentKey, baseURL: stack.origin.origin, maxRetries: 0 });

  await assert.rejects(poller.beta.agents.update(agent.id, { description: marker }), isInaccessible);

  const file = 'proof.txt';
  const deniedFile = 'blocked.txt';

  model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'write', input: { file_path: deniedFile, content: marker } }] },
      { text: 'deny' },
      { tools: [{ id: randomUUID(), name: 'write', input: { file_path: file, content: marker } }] },
      { text: 'allow' },
      { text: `stored ${marker}` },
    ],
  });
  await owner.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
  });

  const work = await waitFor({
    name: 'session work claimed by official SDK',
    read: () => poller.beta.environments.work.poll(environment.id, { block_ms: 500 }),
    accept: (receipt) => receipt !== null,
  });

  assert.ok(work !== null && work.secret !== null && work.data.type === 'session');
  assert.equal(work.data.id, session.id);
  await poller.beta.environments.work.ack(work.id, { environment_id: environment.id });

  function scopedClient(secret: string): Anthropic {
    const authToken = sessionsTokenFromSecret(secret);

    assert.ok(typeof authToken === 'string' && authToken.length > 0);

    return new Anthropic({ authToken, baseURL: stack.origin.origin, maxRetries: 0 });
  }

  const runner = scopedClient(work.secret);
  const ownSession = await runner.beta.sessions.retrieve(session.id);

  assert.equal(ownSession.id, session.id);

  const other = await owner.beta.sessions.create(create);

  await assert.rejects(runner.beta.sessions.retrieve(other.id), isInaccessible);
  await assert.rejects(
    runner.beta.environments.work.heartbeat(work.id, {
      environment_id: environment.id,
      expected_last_heartbeat: '2000-01-01T00:00:00Z',
    }),
    (failure: unknown) => {
      assert.ok(failure instanceof BetaHeartbeatPreconditionFailedError);
      assert.equal(failure.details.current_state.last_heartbeat, null);
      assert.equal(failure.details.current_state.lease_extended, false);

      return true;
    },
  );

  const workdir = await mkdtemp(join(stack.stateDirectory, 'sdk-worker-'));
  const controller = new AbortController();

  try {
    const worker = runner.beta.environments.work.worker({
      workdir,
      tools: (context) => betaAgentToolset20260401(context).filter((tool) => tool.name === 'write'),
      maxIdleMs: 1500,
    });

    await worker.handleItem({
      workId: work.id,
      environmentId: environment.id,
      sessionId: session.id,
      workSecret: work.secret,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(DISPATCH_TIMEOUT_MS)]),
    });
    assert.equal(await readFile(join(workdir, file), 'utf8'), marker);
    await assert.rejects(readFile(join(workdir, deniedFile)), { code: 'ENOENT' });

    const history = [];

    for await (const event of owner.beta.sessions.events.list(session.id)) {
      history.push(event);
    }

    const uses = history.filter((event) => event.type === 'agent.tool_use');
    const denied = uses.find((event) => event.input['file_path'] === deniedFile);

    assert.ok(denied !== undefined);
    assert.deepEqual(denied.evaluation, {
      type: 'auto',
      evaluated_permission: { type: 'deny', reason_code: 'high_risk' },
    });
    assert.equal(denied.evaluated_permission, 'deny');
    assert.ok(
      history.some(
        (event) => event.type === 'agent.tool_result' && event.tool_use_id === denied.id && event.is_error === true,
      ),
    );

    const allowed = uses.find((event) => event.input['file_path'] === file);

    assert.ok(allowed !== undefined);
    assert.deepEqual(allowed.evaluation, { type: 'auto', evaluated_permission: { type: 'allow' } });
    assert.equal(allowed.evaluated_permission, 'allow');
    assert.ok(history.some((event) => event.type === 'user.tool_result' && event.tool_use_id === allowed.id));
    assert.ok(
      history.some(
        (event) =>
          event.type === 'agent.message' &&
          event.content.some((block) => block.type === 'text' && block.text === `stored ${marker}`),
      ),
    );

    const check = { owner, poller, scopedClient, model, environmentId: environment.id };

    await recoverWorkerEffect({ ...check, sessionId: other.id, workdir });

    const settlement = await owner.beta.sessions.create(create);

    await verifySuspendedWorker({ ...check, sessionId: settlement.id, stack, account });

    const operatorStop = await owner.beta.sessions.create(create);
    const stopPrompt = `stop-${marker}`;

    model.configure({
      marker: stopPrompt,
      replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command: 'true' } }] }],
    });
    await owner.beta.sessions.events.send(operatorStop.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: stopPrompt }] }],
    });

    const queued = await waitFor({
      name: 'queued work item for operator stop check',
      read: () => poller.beta.environments.work.poll(environment.id, { block_ms: 500 }),
      accept: (receipt) => receipt !== null && receipt.data.id === operatorStop.id,
    });

    assert.ok(queued !== null && queued.secret !== null);
    await poller.beta.environments.work.ack(queued.id, { environment_id: environment.id });

    const queuedRunner = scopedClient(queued.secret);

    const clampedHeartbeat = await queuedRunner.beta.environments.work
      .heartbeat(queued.id, { environment_id: environment.id, desired_ttl_seconds: OVERSIZED_TTL_SECONDS })
      .withResponse();

    assert.equal(clampedHeartbeat.data.ttl_seconds, CLAMPED_TTL_SECONDS);
    assert.match(clampedHeartbeat.response.headers.get(HttpHeader.AnthropicWorkspaceId) ?? '', /^wrkspc_/u);

    const stopped = await owner.beta.environments.work
      .stop(queued.id, { environment_id: environment.id, force: true })
      .withResponse();

    assert.equal(stopped.data.state, 'stopped');
    assert.match(stopped.response.headers.get(HttpHeader.AnthropicWorkspaceId) ?? '', /^wrkspc_/u);
  } finally {
    controller.abort();
    await rm(workdir, { recursive: true, force: true });
  }
}
