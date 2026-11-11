import { catalog, Mech, Workspace, WorkspaceMember, WorkspaceMemberRemoval } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { createAccount, mechPath, runCli, runCliFailure } from '@mechane/testing';
import type { Account, ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 15_000;

const ApiFailure = Schema.Struct({ error: Schema.Struct({ code: Schema.String }) });
type WorkspaceReadInput = Pick<ScenarioInput, 'stack'> & { readonly account: Account; readonly mechId: string };

async function assertWorkspaceReadRejected({ stack, account, mechId }: WorkspaceReadInput): Promise<void> {
  const response = await fetch(new URL(mechPath({ account, mechId }), stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const failure = Schema.decodeUnknownSync(ApiFailure)(await response.json());

  assert.equal(response.status, HttpStatusCode.NotFound);
  assert.equal(failure.error.code, 'WorkspaceNotFound', 'The API exposed a workspace without current membership');
}

export async function membershipChangesApplyImmediately({ stack }: ScenarioInput): Promise<void> {
  const ownerLogin = stack.fixtures?.github?.users.owner.login;

  assert.ok(
    ownerLogin !== undefined && ownerLogin.length > 0,
    'Workspace administration needs the local installation owner',
  );

  const owner = await createAccount({ stack, login: ownerLogin });
  const member = await createAccount({ stack });

  const workspace = await runCli({
    stack,
    account: owner,
    args: ['workspace', 'create', '--name', `membership-${randomUUID()}`],
    schema: Workspace,
  });

  const mech = await runCli({
    stack,
    account: owner,
    args: ['mech', 'create', '--workspace', workspace.id, '--name', 'membership proof'],
    schema: Mech,
  });

  const scopedMember = { ...member, workspaceId: workspace.id };

  await assertWorkspaceReadRejected({ stack, account: scopedMember, mechId: mech.id });
  await runCli({
    stack,
    account: owner,
    args: ['workspace', 'member', 'set', member.principalId, '--role', 'member', '--workspace', workspace.id],
    schema: WorkspaceMember,
  });

  const visible = await runCli({
    stack,
    account: member,
    args: ['mech', 'show', mech.id, '--workspace', workspace.id],
    schema: Mech,
  });

  assert.equal(visible.id, mech.id);

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
  await assertWorkspaceReadRejected({ stack, account: scopedMember, mechId: mech.id });

  const edited = await fetch(
    new URL(`${mechPath({ account: scopedMember, mechId: mech.id })}/definition`, stack.origin),
    {
      method: catalog.updateMech.method,
      headers: { [HttpHeader.Authorization]: `Bearer ${member.token}`, [HttpHeader.ContentType]: MediaType.Json },
      body: JSON.stringify(
        Schema.encodeSync(catalog.updateMech.body)({ expectedRevision: mech.revision, name: 'Unauthorized edit' }),
      ),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  const failure = Schema.decodeUnknownSync(ApiFailure)(await edited.json());

  assert.equal(edited.status, HttpStatusCode.NotFound);
  assert.equal(failure.error.code, 'WorkspaceNotFound', 'A removed member could still write to the workspace');

  const unchanged = await runCli({
    stack,
    account: owner,
    args: ['mech', 'show', mech.id, '--workspace', workspace.id],
    schema: Mech,
  });

  assert.equal(unchanged.revision, mech.revision);
  assert.equal(unchanged.name, mech.name);
}
