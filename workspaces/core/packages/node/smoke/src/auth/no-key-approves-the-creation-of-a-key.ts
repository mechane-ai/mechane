import { KeyList, KeyPurpose } from '@mechane/protocol';
import type { KeyMetadata } from '@mechane/protocol';
import { check, createdKey, runCli, savedLoginToken, signedInAccount } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import { ScenarioKey } from './constants.ts';

/**
 * Signs in, then creates a key whose approval is first posted with the login key, as a client without a browser session
 * would. The page must refuse it, so the approving browser still finds it pending. The account then holds its login key
 * and the one key the browser approved, none other.
 */
export const noKeyApprovesTheCreationOfAKey = Effect.fn('noKeyApprovesTheCreationOfAKey')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const account = yield* signedInAccount({ stack });
  const login = yield* savedLoginToken({ account });
  const created = yield* createdKey({ stack, account, name: ScenarioKey.Presented, presentedKeys: [login.token] });
  const listed = yield* runCli({ stack, args: ['key', 'list'], environment: account.environment, result: KeyList });
  const others = listed.result.keys.filter((key) => key.id !== created.key.id);
  const keyLabel: (key: KeyMetadata) => string = (key) => `${key.name} (${key.purpose})`;

  yield* check({
    name: guarantee,
    conditions: [others.length === 1, others.every((key) => key.purpose === KeyPurpose.Login)],
    detail: `besides ${created.key.name}, the account holds ${others.map(keyLabel).join(', ')}`,
  });
});
