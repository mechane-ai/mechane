import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { CredentialValue } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import type { Redacted } from 'effect';
import { readFile } from 'node:fs/promises';

type ReadCredentialFileInput = { readonly file: string };

/** Preserves credential whitespace and replaces content-bearing parse failures with fixed messages. */
export const readCredentialFile = Effect.fn('readCredentialFile')(function* ({
  file,
}: ReadCredentialFileInput): Effect.fn.Return<Redacted.Redacted, CredentialsFailed> {
  const value = yield* Effect.tryPromise({
    try: () => readFile(file, 'utf8'),
    catch: () =>
      new CredentialsFailed({ step: CredentialsStep.Read, path: file, reason: 'could not read credential file' }),
  });

  return yield* Schema.decodeUnknownEffect(CredentialValue)(value).pipe(
    Effect.mapError(
      () =>
        new CredentialsFailed({
          step: CredentialsStep.Decode,
          path: file,
          reason: 'credential file must contain one nonempty bounded value',
        }),
    ),
  );
});
