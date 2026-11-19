import Anthropic from '@anthropic-ai/sdk';
import { KeyMetadata } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { createAccount, requireFixtures, runCli, runCliFailure } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';

export async function revokedKeyCannotAuthorizeRequests({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login });
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });

  await client.beta.agents.list({ limit: 1 });

  await runCli({ stack, account, args: ['key', 'revoke', account.keyId], schema: KeyMetadata });

  const refused = await runCliFailure({ stack, account, args: ['workspace', 'list'] });

  assert.equal(refused.code, 'KeyRevoked');
  await assert.rejects(client.beta.agents.list({ limit: 1 }), { status: HttpStatusCode.Unauthorized });
}
