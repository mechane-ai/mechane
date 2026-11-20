import type Anthropic from '@anthropic-ai/sdk';
import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { managedWorkspaceId } from '@mechane/managed-protocol';
import { WorkspaceList } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { runCli, setWorkspacePolicy, waitFor } from '@mechane/testing';
import type { Account, requireFixtures, ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const command = 'printf x >> effects';
const IDLE_TIMEOUT_MS = 500;
const DISPATCH_TIMEOUT_MS = 30_000;

type RecoveryCheck = {
  readonly owner: Anthropic;
  readonly poller: Anthropic;
  readonly scopedClient: (secret: string) => Anthropic;
  readonly model: ReturnType<typeof requireFixtures>['model'];
  readonly environmentId: string;
  readonly sessionId: string;
  readonly workdir: string;
};

type ShellCheck = Omit<RecoveryCheck, 'workdir'>;
type SuspensionCheck = ShellCheck & Pick<ScenarioInput, 'stack'> & { readonly account: Account };

async function claim(poller: Anthropic, environmentId: string) {
  const work = await waitFor({
    name: 'worker claim',
    read: () => poller.beta.environments.work.poll(environmentId),
    accept: (receipt) => receipt !== null,
  });

  assert.ok(work !== null && work.secret !== null);
  await poller.beta.environments.work.ack(work.id, { environment_id: environmentId });

  return { workId: work.id, workSecret: work.secret, sessionId: work.data.id, environmentId };
}

async function receiveShell({ owner, poller, scopedClient, model, environmentId, sessionId }: ShellCheck) {
  const marker = randomUUID();

  model.configure({
    marker,
    replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command } }] }, { text: marker }],
  });
  await owner.beta.sessions.events.send(sessionId, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
  });

  const first = await claim(poller, environmentId);

  assert.equal(first.sessionId, sessionId);

  const prior = scopedClient(first.workSecret);

  const use = await waitFor({
    name: 'worker receives the authorized shell command',
    read: async () => {
      for await (const event of prior.beta.sessions.events.list(sessionId)) {
        if (event.type === 'agent.tool_use' && event.input['command'] === command) {
          return event.id;
        }
      }

      return null;
    },
    accept: (event) => event !== null,
  });

  assert.ok(use !== null);

  return { first, prior, use };
}

export async function recoverWorkerEffect(input: RecoveryCheck) {
  const { owner, poller, scopedClient, environmentId, sessionId, workdir } = input;
  const { first, prior, use } = await receiveShell(input);
  const file = join(workdir, 'effects');

  // The command has taken effect when the original worker loses contact before posting its result.
  await appendFile(file, 'x');
  await prior.beta.environments.work.heartbeat(first.workId, { environment_id: environmentId, desired_ttl_seconds: 1 });

  const next = await claim(poller, environmentId);

  assert.equal(next.sessionId, sessionId);

  const runner = scopedClient(next.workSecret);

  const worker = runner.beta.environments.work.worker({
    workdir,
    tools: (context) => betaAgentToolset20260401(context).filter((tool) => tool.name === 'bash'),
    maxIdleMs: IDLE_TIMEOUT_MS,
  });

  await worker.handleItem({ ...next, signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS) });

  const results = [];

  for await (const event of owner.beta.sessions.events.list(sessionId)) {
    if (event.type === 'user.tool_result' && event.tool_use_id === use) {
      results.push(event.is_error);
    }
  }

  assert.deepEqual(results, [true]);
  assert.equal(await readFile(file, 'utf8'), 'x');
}

export async function verifySuspendedWorker(input: SuspensionCheck) {
  const { owner, poller, environmentId, sessionId, stack, account } = input;
  const { first, prior, use } = await receiveShell(input);
  const { data: session, response } = await owner.beta.sessions.retrieve(sessionId).withResponse();
  const selected = response.headers.get('anthropic-workspace-id');
  const listed = await runCli({ stack, account, args: ['workspace', 'list'], schema: WorkspaceList });
  const workspace = listed.workspaces.find(({ id }) => managedWorkspaceId({ workspaceId: id }) === selected);

  assert.ok(workspace !== undefined);

  const operator = { stack, account: { ...account, workspaceId: workspace.id } };
  const parked = await owner.beta.sessions.create({ agent: session.agent.id, environment_id: environmentId });
  const before = await setWorkspacePolicy({ ...operator, changes: { isSuspended: true } });

  try {
    const waiting = await poller.beta.environments.work.poll(environmentId);

    assert.equal(waiting, null, 'A suspended workspace issued a new work credential');
    await assert.rejects(prior.beta.sessions.events.list(sessionId), { status: HttpStatusCode.Unauthorized });
    await prior.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.tool_result', tool_use_id: use, content: [{ type: 'text', text: 'completed' }] }],
    });

    const history = await owner.beta.sessions.events.list(sessionId);
    const receipts = history.data.filter((event) => event.type === 'user.tool_result' && event.tool_use_id === use);

    assert.equal(receipts.length, 1);
    await prior.beta.environments.work.stop(first.workId, { environment_id: environmentId, force: true });
  } finally {
    await setWorkspacePolicy({ ...operator, changes: { isSuspended: before.isSuspended } });
  }

  const resumed = await claim(poller, environmentId);

  assert.equal(resumed.sessionId, parked.id);
  await owner.beta.sessions.archive(parked.id);
}
