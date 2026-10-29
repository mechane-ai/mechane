import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { Effect, Redacted } from 'effect';
import { access, constants } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PathInput } from './types.ts';
import { writePrivateFile } from './write-private-file.ts';

type TokenInput = { readonly token: Redacted.Redacted };

/** A key file whose folder takes a new file: its write puts the token there. */
type KeyFile = { readonly write: (input: TokenInput) => Effect.Effect<void, CredentialsFailed> };

/**
 * Checks that the folder of a key file can take a new file, and answers with the write of a named key's token alone to
 * that private file. A key creation prepares it before its approval starts, so no key is minted with nowhere to go.
 */
export const prepareKeyFile = Effect.fn('prepareKeyFile')(function* ({
  path,
}: PathInput): Effect.fn.Return<KeyFile, CredentialsFailed> {
  const folder = dirname(path);

  yield* Effect.tryPromise({
    try: () => access(folder, constants.W_OK),
    catch: (cause) => new CredentialsFailed({ step: CredentialsStep.Write, path, reason: String(cause) }),
  });

  const write: KeyFile['write'] = ({ token }) => writePrivateFile({ path, text: `${Redacted.value(token)}\n` });

  return { write };
});
