import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { forgetOnRejection } from './forget-on-rejection.ts';
import { savedCredential } from './saved-credential.ts';
import { forgetLogin } from './store/forget-login.ts';

/**
 * Revokes the saved login's key on the deployment, then removes the saved login; a failed revocation keeps it. A key
 * the deployment already refuses is removed without a claim that it was revoked.
 */
export const runAuthLogout = Effect.fn('runAuthLogout')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'auth logout'>): Effect.fn.Return<CommandResult<'auth logout'>, RunFailure> {
  const { configurationRoot } = credentials;
  const saved = yield* savedCredential({ origin, configurationRoot });

  const key = yield* forgetOnRejection({
    configurationRoot,
    run: call({ name: 'revokeKey', input: { keyId: saved.key.id }, credential: saved.token }),
  });

  const credentialsFile = yield* forgetLogin({ configurationRoot });

  return {
    lines: [`revoked the login key ${key.id} and removed ${credentialsFile}`],
    result: { origin: origin.origin, key, credentialsFile },
  };
});
