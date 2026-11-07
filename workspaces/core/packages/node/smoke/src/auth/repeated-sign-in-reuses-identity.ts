import { WorkspaceList } from '@mechane/protocol';
import { createAccount, runCli } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';

export async function repeatedSignInReusesIdentity({ stack }: ScenarioInput): Promise<void> {
  const first = await createAccount({ stack });
  const second = await createAccount({ stack, login: first.login });
  const listed = await runCli({ stack, account: second, args: ['workspace', 'list'], schema: WorkspaceList });

  assert.equal(second.principalId, first.principalId, 'A repeated provider sign-in created another principal');
  assert.equal(second.workspaceId, first.workspaceId, 'A repeated sign-in created another personal workspace');
  assert.equal(listed.workspaces.filter((workspace) => workspace.name === first.login).length, 1);
}
