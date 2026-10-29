import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { KeyPurpose } from '@mechane/protocol';
import { DateTime, Effect, Option } from 'effect';
import { approveDevice } from './approve-device.ts';
import { revokeReplacedLogin } from './revoke-replaced-login.ts';
import { prepareLoginFile } from './store/prepare-login-file.ts';
import { savedLogin } from './store/saved-login.ts';

/** The name of every login key, which the approval page and `mechane key list` show. */
const LOGIN_KEY_NAME = 'mechane CLI';

/**
 * Signs in through a device approval and saves the new login key for the origin in place of any saved before. It then
 * revokes the replaced key. A login that could not save its key fails before the approval starts.
 */
export const runAuthLogin = Effect.fn('runAuthLogin')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'auth login'>): Effect.fn.Return<CommandResult<'auth login'>, RunFailure> {
  const { configurationRoot } = credentials;
  const replaced = yield* savedLogin({ configurationRoot });
  const loginFile = yield* prepareLoginFile({ configurationRoot });

  const { token, key, principal } = yield* approveDevice({
    call,
    origin,
    purpose: KeyPurpose.Login,
    name: LOGIN_KEY_NAME,
  });

  const credentialsFile = yield* loginFile.save({ login: { origin: origin.origin, token, key, principal } });

  if (Option.isSome(replaced)) {
    yield* revokeReplacedLogin({ call, origin, replaced: replaced.value });
  }

  return {
    lines: [
      `signed in to ${origin.origin} as ${principal.name}`,
      `login key ${key.id} expires at ${DateTime.formatIso(key.expiresAt)}; saved in ${credentialsFile}`,
    ],
    result: { origin: origin.origin, principal, key, credentialsFile },
  };
});
