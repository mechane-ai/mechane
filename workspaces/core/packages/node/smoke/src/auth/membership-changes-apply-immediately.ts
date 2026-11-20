import { BROWSER_AUTHENTICATION_REQUEST, Workspace, WorkspaceMember, WorkspaceMemberRemoval } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { Account, ScenarioInput } from '@mechane/testing';
import { createAccount, requireFixtures, runCli, runCliFailure } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const Environment = Schema.fromJsonString(Schema.Struct({ id: Schema.String, name: Schema.String }));

const Failure = Schema.fromJsonString(
  Schema.Struct({ type: Schema.Literal('error'), error: Schema.Struct({ type: Schema.String }) }),
);

function environmentPath({ id }: { readonly id: string | undefined }): string {
  const root = '/console-api/v1/environments';

  if (id === undefined) {
    return root;
  }

  return `${root}/${encodeURIComponent(id)}`;
}

function workspaceResourcePath({
  root,
  workspaceId,
  resource,
}: {
  readonly root: string;
  readonly workspaceId: string;
  readonly resource: string;
}): string {
  return `${root}/workspaces/${encodeURIComponent(workspaceId)}/${resource}`;
}

export async function membershipChangesApplyImmediately({ stack }: ScenarioInput): Promise<void> {
  const owner = await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login });
  const member = await createAccount({ stack });

  const workspace = await runCli({
    stack,
    account: owner,
    args: ['workspace', 'create', '--name', `membership-${randomUUID()}`],
    schema: Workspace,
  });

  async function environmentRequest(account: Account, id?: string, body?: Readonly<Record<string, unknown>>) {
    const path = environmentPath({ id });
    const url = new URL(path, stack.origin);

    const headers = {
      'anthropic-workspace-id': workspace.id,
      'anthropic-beta': 'managed-agents-2026-04-01',
      'anthropic-version': '2026-10-21',
      [HttpHeader.Origin]: stack.origin.origin,
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.BrowserAuthentication]: BROWSER_AUTHENTICATION_REQUEST,
    };

    if (body === undefined) {
      return await account.browser.request({ url, headers });
    }

    return await account.browser.request({ url, headers, method: HttpMethod.Post, body: JSON.stringify(body) });
  }

  const saved = await environmentRequest(owner, undefined, {
    name: 'membership proof',
    config: { type: 'self_hosted' },
  });

  assert.equal(saved.status, HttpStatusCode.Ok);

  const environment = Schema.decodeUnknownSync(Environment)(saved.text);

  async function assertRemoved(id: string, body?: Readonly<Record<string, unknown>>): Promise<void> {
    const denied = await environmentRequest(member, id, body);

    assert.equal(denied.status, HttpStatusCode.Forbidden);
    assert.equal(Schema.decodeUnknownSync(Failure)(denied.text).error.type, 'permission_error');
  }

  await assertRemoved(environment.id);
  await runCli({
    stack,
    account: owner,
    args: ['workspace', 'member', 'set', member.principalId, '--role', 'member', '--workspace', workspace.id],
    schema: WorkspaceMember,
  });

  const credentialsPath = workspaceResourcePath({
    root: '/api/v1',
    workspaceId: workspace.id,
    resource: 'credentials',
  });

  const credentials = new URL(credentialsPath, stack.origin);

  const ownerCredentials = await owner.browser.request({ url: credentials });
  const memberCredentials = await member.browser.request({ url: credentials });

  assert.equal(ownerCredentials.status, HttpStatusCode.Ok);
  assert.equal(memberCredentials.status, HttpStatusCode.Forbidden);

  const retiredPath = workspaceResourcePath({ root: '/api/operator', workspaceId: workspace.id, resource: 'mechs' });
  const retiredRead = await owner.browser.request({ url: new URL(retiredPath, stack.origin) });

  assert.equal(retiredRead.status, HttpStatusCode.NotFound);

  const retiredCreatePath = workspaceResourcePath({ root: '/api/v1', workspaceId: workspace.id, resource: 'mechs' });

  const retiredCreate = await owner.browser.request({
    url: new URL(retiredCreatePath, stack.origin),
    method: HttpMethod.Post,
    headers: { [HttpHeader.Origin]: stack.origin.origin, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ name: 'retired definition' }),
  });

  assert.equal(retiredCreate.status, HttpStatusCode.NotFound);

  const visible = await environmentRequest(member, environment.id);

  assert.equal(visible.status, HttpStatusCode.Ok);
  assert.equal(Schema.decodeUnknownSync(Environment)(visible.text).id, environment.id);

  const refusedEdit = await runCliFailure({
    stack,
    account: member,
    args: ['workspace', 'member', 'set', member.principalId, '--role', 'owner', '--workspace', workspace.id],
  });

  assert.equal(refusedEdit.code, 'WorkspaceOwnerRequired');
  await runCli({
    stack,
    account: owner,
    args: ['workspace', 'member', 'remove', member.principalId, '--workspace', workspace.id],
    schema: WorkspaceMemberRemoval,
  });

  const formerMemberCredentials = await member.browser.request({ url: credentials });

  assert.equal(formerMemberCredentials.status, HttpStatusCode.NotFound);
  await assertRemoved(environment.id);
  await assertRemoved(environment.id, { name: 'Unauthorized edit' });

  const unchanged = await environmentRequest(owner, environment.id);

  assert.equal(unchanged.status, HttpStatusCode.Ok);
  assert.equal(Schema.decodeUnknownSync(Environment)(unchanged.text).name, environment.name);
}
