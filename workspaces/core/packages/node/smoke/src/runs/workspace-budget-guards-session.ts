import { ManagedAgentPolicy, WorkspaceList, WorkspacePolicy } from '@mechane/protocol';
import { createManagedContext, requireFixtures, runCli, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { message, waitForReply } from './session-messages.ts';

export async function workspaceBudgetGuardsSession({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const agentLimited = randomUUID();
  const funded = randomUUID();
  const finalAnswer = randomUUID();
  const context = await createManagedContext({ stack, name: marker });
  const { client, session, account } = context;

  model.configure({ marker, replies: [{ text: 'The unfunded request reached the provider' }] });
  model.configure({ marker: agentLimited, replies: [{ text: 'The agent-limited request reached the provider' }] });
  model.configure({ marker: funded, replies: [{ text: finalAnswer }] });

  const workspaces = await runCli({ stack, account, args: ['workspace', 'list'], schema: WorkspaceList });
  const workspace = workspaces.workspaces.find((candidate) => candidate.name === 'Softmax');

  assert.ok(workspace !== undefined, 'The installation workspace must exist');

  const workspaceId = workspace.id;

  const policy = await runCli({
    stack,
    account,
    args: ['workspace', 'policy', 'show', workspaceId],
    schema: WorkspacePolicy,
  });

  const agentArgs = [context.agent.id, '--workspace', workspaceId];

  const original = await runCli({
    stack,
    account,
    args: ['agent-policy', 'show', ...agentArgs],
    schema: ManagedAgentPolicy,
  });

  assert.equal(original.creatorPrincipalId, account.principalId);
  assert.equal(original.dailyCapMicros, workspace.dailyAllowanceMicros);

  async function setAgentCap(amount: number) {
    return await runCli({
      stack,
      account,
      args: ['agent-policy', 'set', ...agentArgs, '--daily-cap-micros', String(amount)],
      schema: ManagedAgentPolicy,
    });
  }

  async function setAllowance(amount: number) {
    await runCli({
      stack,
      account,
      args: [
        'workspace',
        'policy',
        'set',
        workspaceId,
        '--suspended',
        String(policy.isSuspended),
        '--sandboxes',
        String(policy.hasSandboxes),
        '--machines',
        String(policy.machines),
        '--daily-allowance-micros',
        String(amount),
      ],
      schema: WorkspacePolicy,
    });
  }

  try {
    await setAllowance(0);
    await client.beta.sessions.events.send(session.id, { events: [message(marker)] });
    await waitFor({
      name: 'an observable refusal for the unfunded model call',
      read: () => client.beta.sessions.events.list(session.id),
      accept: (page) => page.data.some((event) => event.type === 'session.error'),
    });
    assert.equal(model.readCalls({ marker }).length, 0);

    const refused = await client.beta.sessions.retrieve(session.id);

    assert.equal(refused.usage.output_tokens ?? 0, 0);
  } finally {
    await setAllowance(policy.dailyAllowanceMicros);
  }

  try {
    const limited = await setAgentCap(0);

    assert.equal(limited.dailyCapMicros, 0);
    await client.beta.sessions.events.send(session.id, { events: [message(agentLimited)] });
    await waitFor({
      name: 'an agent spending refusal while the workspace is funded',
      read: () => client.beta.sessions.events.list(session.id, { types: ['session.error'] }),
      accept: (page) =>
        page.data.some(
          (event) =>
            event.type === 'session.error' && event.error.message === 'The agent reached its model spending limit',
        ),
    });
    assert.equal(model.readCalls({ marker: agentLimited }).length, 0);
  } finally {
    await setAgentCap(original.dailyCapMicros);
  }

  await client.beta.sessions.events.send(session.id, { events: [message(funded)] });
  await waitForReply(context, finalAnswer);
  assert.equal(model.readCalls({ marker: funded }).length, 1);
  assert.equal(model.readCalls({ marker }).length, 0, 'Restoring the allowance reissued the failed provider attempt');
}
