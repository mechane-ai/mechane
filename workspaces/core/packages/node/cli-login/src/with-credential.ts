import { CredentialSource } from '@mechane/cli-kernel';
import type { Credential, CredentialSettings, RunFailure } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { forgetOnRejection } from './forget-on-rejection.ts';
import { savedCredential } from './saved-credential.ts';

type WithCredentialInput<A> = {
  readonly origin: URL;
  readonly credentials: CredentialSettings;
  readonly use: (credential: Credential) => Effect.Effect<A, RunFailure>;
};

/** Runs `use` with the key a command sends: the API key variable's when it holds one, else the saved login's. */
export const withCredential = Effect.fn('withCredential')(function* <A>({
  origin,
  credentials,
  use,
}: WithCredentialInput<A>): Effect.fn.Return<A, RunFailure> {
  const { apiKey, configurationRoot } = credentials;

  if (Option.isSome(apiKey)) {
    return yield* use({ token: apiKey.value, source: CredentialSource.Variable });
  }

  const saved = yield* savedCredential({ origin, configurationRoot });

  return yield* forgetOnRejection({
    configurationRoot,
    run: use({ token: saved.token, source: CredentialSource.SavedLogin }),
  });
});
