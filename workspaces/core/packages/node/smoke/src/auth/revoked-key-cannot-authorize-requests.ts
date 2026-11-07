import { KeyMetadata } from '@mechane/protocol';
import { createAccount, runCli, runCliFailure } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';

export async function revokedKeyCannotAuthorizeRequests({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });

  await runCli({ stack, account, args: ['key', 'revoke', account.keyId], schema: KeyMetadata });

  const refused = await runCliFailure({ stack, account, args: ['workspace', 'list'] });

  assert.equal(refused.code, 'KeyRevoked', 'A revoked key still authorized the public API');
}
