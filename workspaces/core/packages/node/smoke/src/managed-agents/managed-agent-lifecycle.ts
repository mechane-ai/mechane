import Anthropic from '@anthropic-ai/sdk';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { createAccount, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function managedAgentLifecycle({ stack }: ScenarioInput): Promise<void> {
  const { github } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const outsider = await createAccount({ stack, login: github.users.member.login });
  const owner = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const other = new Anthropic({ baseURL: stack.origin.origin, apiKey: outsider.token, maxRetries: 0 });

  const malformed = await fetch(new URL('/v1/agents', stack.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ApiKey]: account.token,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'managed-agents-2026-04-01',
      [HttpHeader.ContentType]: MediaType.Json,
    },
    body: JSON.stringify({ name: 'missing model' }),
  });

  assert.equal(malformed.status, HttpStatusCode.BadRequest);

  const problem = await malformed.json();

  assert.partialDeepStrictEqual(problem, { type: 'error', error: { type: 'invalid_request_error' } });
  assert.match(malformed.headers.get('request-id') ?? '', /^req_/u);

  const name = `wire-${randomUUID()}`;

  const created = await owner.beta.agents
    .create({ name, model: 'claude-haiku-5-5', metadata: { proof: name } })
    .withResponse();

  assert.equal(created.response.status, HttpStatusCode.Ok);
  assert.match(created.response.headers.get('request-id') ?? '', /^req_/u);

  const agent = created.data;

  assert.match(agent.id, /^agent_/u);
  assert.equal(agent.type, 'agent');
  assert.equal(agent.name, name);
  assert.deepEqual(agent.metadata, { proof: name });
  assert.equal(agent.version, 1);

  await verifyModelOptions(owner);

  const retrieved = await owner.beta.agents.retrieve(agent.id);

  assert.equal(retrieved.id, agent.id);

  const updated = await owner.beta.agents.update(agent.id, { version: agent.version, description: name });

  assert.equal(updated.version, agent.version + 1);
  await assert.rejects(owner.beta.agents.update(agent.id, { version: agent.version, description: 'stale' }), {
    status: HttpStatusCode.Conflict,
  });
  await assert.rejects(other.beta.agents.retrieve(agent.id), { status: HttpStatusCode.Forbidden });

  const missingId = `agent_${randomUUID().replaceAll('-', '')}`;

  await assert.rejects(owner.beta.agents.retrieve(missingId), { status: HttpStatusCode.NotFound });

  const invalid = new Anthropic({ baseURL: stack.origin.origin, apiKey: 'invalid-fixture-token', maxRetries: 0 });

  await assert.rejects(invalid.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
  await assert.rejects(owner.beta.environments.create({ name, config: { type: 'cloud' } }), {
    status: HttpStatusCode.BadRequest,
  });
  await owner.beta.agents.archive(agent.id);
  await assert.rejects(owner.beta.agents.update(agent.id, { description: 'archived' }), {
    status: HttpStatusCode.Conflict,
  });
}

async function verifyModelOptions(client: Anthropic): Promise<void> {
  const id = 'openai/gpt-6.1-sol';
  const name = 'Model settings';
  const agent = await client.beta.agents.create({ name, model: id });

  assert.deepEqual(agent.model, { id, speed: 'standard', effort: { type: 'medium' } });

  const high = await client.beta.agents.update(agent.id, { model: { id, effort: 'high' } });
  const preserved = await client.beta.agents.update(agent.id, { model: { id, speed: 'standard' } });

  assert.equal(high.model.effort?.type, 'high');
  assert.deepEqual(preserved.model, high.model);
  assert.equal(preserved.version, high.version);

  const environment = await client.beta.environments.create({ name, config: { type: 'self_hosted' } });

  const session = await client.beta.sessions.create({
    environment_id: environment.id,
    agent: { type: 'agent_with_overrides', id: agent.id, model: id },
  });

  const saved = await client.beta.agents.retrieve(agent.id);

  assert.deepEqual(session.agent.model, agent.model);
  assert.deepEqual(saved.model, high.model);

  const unsupported = { status: HttpStatusCode.BadRequest };

  await assert.rejects(client.beta.agents.create({ name, model: { id, effort: { type: 'max' } } }), unsupported);
  await assert.rejects(client.beta.agents.create({ name, model: { id, speed: 'fast' } }), unsupported);
  await assert.rejects(client.beta.agents.update(agent.id, { model: { id, inference_geo: 'us' } }), unsupported);

  const changed = await client.beta.agents.update(agent.id, { model: 'claude-haiku-5-5' });

  assert.deepEqual(changed.model, { id: 'claude-haiku-5-5', speed: 'standard' });
  await client.beta.agents.archive(agent.id);
  await client.beta.environments.archive(environment.id);
}
