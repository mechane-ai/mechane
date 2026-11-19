import Anthropic from '@anthropic-ai/sdk';
import {
  catalog,
  ManagedAgentPolicy,
  managedWorkspaceId,
  RevokedWorkspaceServiceKey,
  Workspace,
  WorkspaceMember,
  WorkspaceMemberRemoval,
  WorkspaceServicePrincipal,
} from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import type { ScenarioInput } from '@mechane/testing';
import { createAccount, requireFixtures, runCli, runCliFailure, startCli } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PERMISSION_MODE_RANGE = 0o1000;
const PRIVATE_KEY_MODE = 0o600;
const RotationOutput = Schema.fromJsonString(Schema.Struct({ result: WorkspaceServicePrincipal }));

export async function workspaceServiceKeysIsolateCreators({ stack }: ScenarioInput): Promise<void> {
  const owner = await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login });

  async function createWorkspace() {
    return await runCli({
      stack,
      account: owner,
      args: ['workspace', 'create', '--name', randomUUID()],
      schema: Workspace,
    });
  }

  const workspace = await createWorkspace();

  const subject = 'nexus.maintenance';

  async function rotate(profile = subject, workspaceId = workspace.id) {
    const file = join(owner.configurationRoot, randomUUID());

    const running = startCli({
      stack,
      account: owner,
      args: ['service-principal', 'rotate', profile, '--key-file', file, '--workspace', workspaceId],
    });

    const { status, stdout, stderr } = await running.finished;

    assert.equal(status, 0, 'Service credential rotation failed');

    const { result: principal } = Schema.decodeUnknownSync(RotationOutput)(stdout);
    const key = Option.getOrThrow(principal.activeKey);
    const secret = await readFile(file, 'utf8');
    const token = secret.trim();
    const fileStatus = await stat(file);

    assert.equal(fileStatus.mode % PERMISSION_MODE_RANGE, PRIVATE_KEY_MODE);
    assert.ok(!stdout.includes(token) && !stderr.includes(token), 'The CLI printed a service credential');

    return { ...key, principalId: principal.principalId, token };
  }

  const key = await rotate();
  const second = await rotate('nexus.health');

  function serviceClient(token: string) {
    return new Anthropic({ baseURL: stack.origin.origin, apiKey: token, maxRetries: 0 });
  }

  const maintenance = serviceClient(key.token);
  const health = serviceClient(second.token);
  const agent = await maintenance.beta.agents.create({ name: randomUUID(), model: 'claude-haiku-5-5' });

  assert.notEqual(key.principalId, owner.principalId);
  assert.notEqual(key.principalId, second.principalId);
  await assert.rejects(health.beta.agents.retrieve(agent.id), { status: HttpStatusCode.NotFound });
  await assert.rejects(maintenance.beta.environments.create({ name: randomUUID(), config: { type: 'self_hosted' } }), {
    status: HttpStatusCode.Forbidden,
  });

  const other = await createWorkspace();
  const sameSubject = await rotate(subject, other.id);

  assert.notEqual(sameSubject.principalId, key.principalId);

  const otherService = serviceClient(sameSubject.token);

  await assert.rejects(otherService.beta.agents.retrieve(agent.id), { status: HttpStatusCode.NotFound });

  const ownHeaders = { 'anthropic-workspace-id': managedWorkspaceId({ workspaceId: workspace.id }) };
  const otherHeaders = { 'anthropic-workspace-id': managedWorkspaceId({ workspaceId: other.id }) };
  const selected = await maintenance.beta.agents.retrieve(agent.id, {}, { headers: ownHeaders });

  assert.equal(selected.id, agent.id);
  await assert.rejects(maintenance.beta.agents.list({}, { headers: otherHeaders }), {
    status: HttpStatusCode.Forbidden,
  });

  const ownerPolicy = await runCli({
    stack,
    account: owner,
    args: ['agent-policy', 'show', agent.id, '--workspace', workspace.id],
    schema: ManagedAgentPolicy,
  });

  assert.equal(ownerPolicy.creatorPrincipalId, key.principalId);

  const foreignPolicy = await runCliFailure({
    stack,
    account: owner,
    args: ['agent-policy', 'set', agent.id, '--workspace', other.id, '--daily-cap-micros', '0'],
  });

  assert.equal(foreignPolicy.code, 'RequestInvalid');

  const policyPath = catalog.configureManagedAgentPolicy.path
    .replace(':workspace_id', workspace.id)
    .replace(':agent_id', agent.id);

  const policyWrite = await fetch(new URL(policyPath, stack.origin), {
    method: catalog.configureManagedAgentPolicy.method,
    headers: { [HttpHeader.Authorization]: `Bearer ${key.token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ daily_cap_micros: 0 }),
  });

  assert.equal(policyWrite.status, HttpStatusCode.Unauthorized);

  const expansion = await runCliFailure({
    stack,
    account: owner,
    args: ['workspace', 'member', 'set', key.principalId, '--role', 'member', '--workspace', other.id],
  });

  assert.equal(expansion.code, 'RequestInvalid');

  const operatorResponse = await fetch(new URL(catalog.showPrincipal.path, stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${key.token}` },
  });

  assert.equal(operatorResponse.status, HttpStatusCode.Unauthorized);

  const rotated = await rotate();

  assert.equal(rotated.principalId, key.principalId);
  assert.notEqual(rotated.keyId, key.keyId);
  await assert.rejects(maintenance.beta.agents.list(), { status: HttpStatusCode.Unauthorized });

  const successor = serviceClient(rotated.token);
  const original = await successor.beta.agents.retrieve(agent.id);

  assert.equal(original.id, agent.id);

  async function addMember(principalId: string) {
    return await runCli({
      stack,
      account: owner,
      args: ['workspace', 'member', 'set', principalId, '--role', 'member', '--workspace', workspace.id],
      schema: WorkspaceMember,
    });
  }

  const member = await createAccount({ stack });

  await addMember(member.principalId);

  const memberPolicy = await runCliFailure({
    stack,
    account: member,
    args: ['agent-policy', 'show', agent.id, '--workspace', workspace.id],
  });

  assert.equal(memberPolicy.code, 'WorkspaceOwnerRequired');

  const memberRotate = await runCliFailure({
    stack,
    account: member,
    args: ['service-principal', 'show', subject, '--workspace', workspace.id],
  });

  assert.equal(memberRotate.code, 'WorkspaceOwnerRequired');

  const promotion = await runCliFailure({
    stack,
    account: owner,
    args: ['workspace', 'member', 'set', key.principalId, '--role', 'owner', '--workspace', workspace.id],
  });

  assert.equal(promotion.code, 'RequestInvalid');

  const wrongKey = await runCliFailure({
    stack,
    account: owner,
    args: ['service-principal', 'revoke', subject, second.keyId, '--workspace', workspace.id],
  });

  assert.equal(wrongKey.code, 'KeyNotFound');
  await health.beta.agents.list();
  await runCli({
    stack,
    account: owner,
    args: ['workspace', 'member', 'remove', key.principalId, '--workspace', workspace.id],
    schema: WorkspaceMemberRemoval,
  });
  await assert.rejects(successor.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
  await addMember(key.principalId);
  await assert.rejects(successor.beta.agents.list(), { status: HttpStatusCode.Unauthorized });

  const reprovisioned = await rotate();

  assert.equal(reprovisioned.principalId, key.principalId);

  const restored = serviceClient(reprovisioned.token);
  const retained = await restored.beta.agents.retrieve(agent.id);

  assert.equal(retained.id, agent.id);

  const issuer = {
    name: 'staff',
    issuer_url: 'https://identity.example.test',
    audiences: ['managed-agents'],
    default_role: 'user',
  };

  try {
    await stack.restart({
      environment: { MECHANE_REFUSE_SERVER_API_KEY: 'true', MECHANE_OIDC_ISSUERS: JSON.stringify([issuer]) },
    });
    await assert.rejects(restored.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
  } finally {
    await stack.restart({ environment: { MECHANE_REFUSE_SERVER_API_KEY: null, MECHANE_OIDC_ISSUERS: null } });
  }

  await runCli({
    stack,
    account: owner,
    args: ['service-principal', 'revoke', subject, reprovisioned.keyId, '--workspace', workspace.id],
    schema: RevokedWorkspaceServiceKey,
  });
  await assert.rejects(restored.beta.agents.list(), { status: HttpStatusCode.Unauthorized });
  await health.beta.agents.list();
}
