import Anthropic from '@anthropic-ai/sdk';
import { HttpStatusCode } from '@mechane/records';
import { createAccount, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const GIT_HOST = 'scm.example.test';

export async function gitResourceCredentialsStayPrivate({ stack }: ScenarioInput): Promise<void> {
  const { github } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const owner = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const name = randomUUID();
  const environment = await owner.beta.environments.create({ name, config: { type: 'self_hosted' } });
  const agent = await owner.beta.agents.create({ name, model: 'claude-haiku-5-5' });
  const sessionParameters = { agent: agent.id, environment_id: environment.id };
  const first = randomUUID();
  const rotated = randomUUID();

  const repository = {
    type: 'github_repository',
    url: 'https://scm.example.test/team/repo',
    authorization_token: first,
  } as const;

  const policy = { allowedHostnames: [GIT_HOST], allowedPushRefs: ['refs/heads/agent/'] };

  await stack.restart({ environment: { MECHANE_MANAGED_GIT: JSON.stringify(policy) } });

  try {
    const forbidden = { ...repository, url: 'https://other.example.test/team/repo' };

    await assert.rejects(owner.beta.sessions.create({ ...sessionParameters, resources: [forbidden] }), {
      status: HttpStatusCode.BadRequest,
    });

    const session = await owner.beta.sessions.create({ ...sessionParameters, resources: [repository] });
    const [resource] = session.resources;

    assert.ok(resource?.type === 'github_repository');
    assert.equal(resource.url, repository.url);

    const resources = owner.beta.sessions.resources;
    const updated = await resources.update(resource.id, { session_id: session.id, authorization_token: rotated });
    const list = await resources.list(session.id);
    const read = await resources.retrieve(resource.id, { session_id: session.id });

    assert.ok(updated.type === 'github_repository');
    assert.equal(updated.id, resource.id);
    assert.ok(read.type === 'github_repository');
    assert.equal(read.id, resource.id);

    const [listed] = list.data;

    assert.ok(listed?.type === 'github_repository');
    assert.equal(listed.id, resource.id);

    const responses = JSON.stringify([session, updated, read, list.data]);

    assert.ok(!responses.includes(first) && !responses.includes(rotated));
  } finally {
    await stack.restart({ environment: { MECHANE_MANAGED_GIT: '{}' } });
  }
}
