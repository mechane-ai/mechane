import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { rm } from 'node:fs/promises';
import { credentialsPath } from './credentials-path.ts';
import type { ConfigurationRootInput } from './types.ts';

/** Removes the saved login, if there is one, and answers with the path it removed. */
export const forgetLogin = Effect.fn('forgetLogin')(function* ({
  configurationRoot,
}: ConfigurationRootInput): Effect.fn.Return<string, CredentialsFailed> {
  const path = credentialsPath({ configurationRoot });

  yield* Effect.tryPromise({
    try: () => rm(path, { force: true }),
    catch: (cause) => new CredentialsFailed({ step: CredentialsStep.Remove, path, reason: String(cause) }),
  });

  return path;
});
