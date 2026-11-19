import Anthropic from '@anthropic-ai/sdk';
import { WorkspaceList } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { startHttpService } from '@mechane/stack';
import type { ModelFixture } from '@mechane/stack';
import { createAccount, requireFixtures, runCli, setWorkspacePolicy, startMcpFixture, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const RpcMethod = Schema.Struct({ method: Schema.String, id: Schema.optionalKey(Schema.Unknown) });

export async function remoteToolGrantsHonorPolicy({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const fixture = await startMcpFixture();
  const initial = randomUUID();
  const replacement = randomUUID();
  let expectedAuthorization: string | null = `Bearer ${initial}`;

  const server = await startHttpService(async (request) => {
    if (request.headers.get(HttpHeader.Authorization) !== expectedAuthorization) {
      return new Response(null, { status: HttpStatusCode.Unauthorized });
    }

    if (request.method !== HttpMethod.Post) {
      return new Response(null, { status: HttpStatusCode.MethodNotAllowed });
    }

    const rpc = Schema.decodeUnknownSync(RpcMethod)(await request.clone().json());
    const forwarded = new Request(fixture.origin, request);

    forwarded.headers.delete(HttpHeader.Host);
    forwarded.headers.delete(HttpHeader.Authorization);

    const response = await fetch(forwarded);

    if (rpc.method !== 'tools/call' || !response.ok) {
      return response;
    }

    await response.body?.cancel();

    return Response.json({
      jsonrpc: '2.0',
      id: rpc.id,
      result: { content: [{ type: 'text', text: `receipt ${expectedAuthorization}` }] },
    });
  });

  const hosts = JSON.stringify([server.origin.hostname]);

  try {
    await stack.restart({
      environment: { MECHANE_MCP_ALLOWED_HOSTNAMES: hosts, MECHANE_MCP_PRIVATE_HOSTNAMES: hosts },
    });

    const vault = await client.beta.vaults.create({ display_name: 'MCP approval scope' });

    try {
      const credential = await client.beta.vaults.credentials.create(vault.id, {
        auth: { type: 'static_bearer', mcp_server_url: server.origin.href, token: initial },
      });

      const environment = await client.beta.environments.create({
        name: 'MCP fixture',
        config: { type: 'self_hosted' },
      });

      const agent = await client.beta.agents.create({
        model: 'claude-haiku-5-5',
        name: 'MCP approval fixture',
        mcp_servers: [{ type: 'url', name: 'proof', url: server.origin.href }],
        tools: [
          {
            type: 'mcp_toolset',
            mcp_server_name: 'proof',
            default_config: { enabled: false },
            configs: [{ name: fixture.names.Unsafe, enabled: true, permission_policy: { type: 'always_ask' } }],
          },
        ],
      });

      const input = {
        client,
        model,
        name: fixture.names.Unsafe,
        environmentId: environment.id,
        agentId: agent.id,
        vaultIds: [vault.id],
      };

      const denied = await requestApproval(input);

      assert.deepEqual(fixture.readCalls(), []);
      await denied.confirm('deny');

      const denial = await denied.readResult();

      assert.equal(denial.is_error, true);
      assert.deepEqual(fixture.readCalls(), []);

      const allowed = await requestApproval(input);

      assert.deepEqual(fixture.readCalls(), []);
      await client.beta.vaults.credentials.update(credential.id, {
        vault_id: vault.id,
        auth: { type: 'static_bearer', token: replacement },
      });

      expectedAuthorization = `Bearer ${replacement}`;

      await allowed.confirm('allow');

      const result = await allowed.readResult();

      assert.ok(result.is_error !== true, 'The rotated credential did not authorize the pending call');
      assert.deepEqual(fixture.readCalls(), [fixture.names.Unsafe]);
      assert.ok(result.content?.some((block) => block.type === 'text' && block.text.startsWith('receipt ')) === true);
      assert.ok(!JSON.stringify(result).includes(replacement), 'The remote response exposed a vault credential');
      await assert.rejects(allowed.confirm('allow'), { status: HttpStatusCode.BadRequest });

      const revoked = await requestApproval(input);

      await client.beta.vaults.credentials.archive(credential.id, { vault_id: vault.id });
      await revoked.confirm('allow');

      const refusal = await revoked.readResult();

      assert.equal(refusal.is_error, true);
      assert.deepEqual(
        fixture.readCalls(),
        [fixture.names.Unsafe],
        'Repeated confirmation or revocation allowed another effect',
      );

      expectedAuthorization = null;
      const anonymous = await requestApproval({ ...input, vaultIds: [] });
      const discovered = fixture.holdNextDiscovery();
      const listed = await runCli({ stack, account, args: ['workspace', 'list'], schema: WorkspaceList });
      const workspace = listed.workspaces.find((entry) => entry.name === 'Softmax');

      assert.ok(workspace !== undefined);

      const operator = { stack, account: { ...account, workspaceId: workspace.id } };

      try {
        await anonymous.confirm('allow');
        await discovered.waitForRequest();

        const before = await setWorkspacePolicy({ ...operator, changes: { isSuspended: true } });

        try {
          discovered.release();

          const suspended = await anonymous.readResult();

          assert.equal(suspended.is_error, true);
          assert.deepEqual(await allowed.readResult(), result);
          assert.deepEqual(fixture.readCalls(), [fixture.names.Unsafe]);
        } finally {
          await setWorkspacePolicy({ ...operator, changes: { isSuspended: before.isSuspended } });
        }
      } finally {
        discovered.release();
      }
    } finally {
      await client.beta.vaults.delete(vault.id);
    }
  } finally {
    await Promise.all([
      server.close(),
      fixture.close(),
      stack.restart({ environment: { MECHANE_MCP_ALLOWED_HOSTNAMES: '[]', MECHANE_MCP_PRIVATE_HOSTNAMES: '[]' } }),
    ]);
  }
}

type ApprovalInput = {
  readonly client: Anthropic;
  readonly model: ModelFixture;
  readonly name: string;
  readonly environmentId: string;
  readonly agentId: string;
  readonly vaultIds: ReadonlyArray<string>;
};

async function requestApproval({ client, model, name, environmentId, agentId, vaultIds }: ApprovalInput) {
  const marker = randomUUID();

  model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name, namePrefix: 'mcp_', input: {} }] },
      { text: 'Observed the MCP decision.' },
    ],
  });

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    vault_ids: [...vaultIds],
    initial_events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
  });

  const uses = await waitFor({
    name: 'the discovered MCP tool to request approval',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.mcp_tool_use'] }),
    accept: (page) => page.data.some((event) => event.type === 'agent.mcp_tool_use'),
  });

  const use = uses.data.find((event) => event.type === 'agent.mcp_tool_use');

  assert.ok(use !== undefined);
  assert.equal(use.name, name);
  assert.equal(use.evaluated_permission, 'ask');

  const toolUseId = use.id;

  async function confirm(result: 'allow' | 'deny') {
    return await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.tool_confirmation', tool_use_id: toolUseId, result }],
    });
  }

  async function readResult() {
    const results = await waitFor({
      name: 'the approved or refused MCP result',
      read: () => client.beta.sessions.events.list(session.id, { types: ['agent.mcp_tool_result'] }),
      accept: (page) =>
        page.data.some((event) => event.type === 'agent.mcp_tool_result' && event.mcp_tool_use_id === toolUseId),
    });

    const result = results.data.find(
      (event) => event.type === 'agent.mcp_tool_result' && event.mcp_tool_use_id === toolUseId,
    );

    assert.ok(result?.type === 'agent.mcp_tool_result');

    return result;
  }

  return { confirm, readResult };
}
