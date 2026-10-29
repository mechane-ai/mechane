import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { approveDevice, prepareKeyFile } from '@mechane/cli-login';
import { KeyPurpose } from '@mechane/protocol';
import { DateTime, Effect } from 'effect';

/**
 * Creates a named key through a device approval and writes its token to the key file, whose folder it checks before the
 * approval starts; the saved login stays.
 */
export const runKeyCreate = Effect.fn('runKeyCreate')(function* ({
  call,
  origin,
  input,
}: RunInput<'key create'>): Effect.fn.Return<CommandResult<'key create'>, RunFailure> {
  const { name, keyFile } = input;
  const destination = yield* prepareKeyFile({ path: keyFile });
  const { token, key, principal } = yield* approveDevice({ call, origin, purpose: KeyPurpose.Named, name });

  yield* destination.write({ token });

  return {
    lines: [
      `created the key ${key.name} (${key.id}) of ${principal.name}; it expires at ${DateTime.formatIso(key.expiresAt)}`,
      `wrote its token to ${keyFile}`,
    ],
    result: { principal, key, keyFile },
  };
});
