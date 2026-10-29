import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import { Effect } from 'effect';
import { keyLine } from './key-line.ts';

/** Revokes one key of the account the CLI's key signs in as. */
export const runKeyRevoke = Effect.fn('runKeyRevoke')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'key revoke'>): Effect.fn.Return<CommandResult<'key revoke'>, RunFailure> {
  const key = yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => call({ name: 'revokeKey', input, credential: token }),
  });

  return { lines: [keyLine({ key })], result: key };
});
