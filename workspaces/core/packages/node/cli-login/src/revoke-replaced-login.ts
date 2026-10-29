import type { ClientFailure, OperationCall } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import { Effect } from 'effect';
import type { SavedLogin } from './schemas.ts';
import { skipDeadKey } from './skip-dead-key.ts';

type RevokeReplacedLoginInput = {
  readonly call: OperationCall<'revokeKey'>;
  readonly origin: URL;
  /** The login the new one replaced in the saved login's file. */
  readonly replaced: SavedLogin;
};

type RevokeLoginKeyInput = Omit<RevokeReplacedLoginInput, 'origin'>;

/**
 * Revokes the login key that a new login replaced, with that key itself, once the new one is saved. A key the
 * deployment already refuses, such as an expired one, is dead already, and a login of another origin stays live there.
 */
export const revokeReplacedLogin = Effect.fn('revokeReplacedLogin')(function* ({
  call,
  origin,
  replaced,
}: RevokeReplacedLoginInput): Effect.fn.Return<void, ClientFailure> {
  if (replaced.origin !== origin.origin) {
    writeDiagnostic({
      program: PROGRAM,
      line: `the replaced login key ${replaced.key.id} of ${replaced.origin} stays live there until it expires`,
    });

    return;
  }

  yield* revokeLoginKey({ call, replaced }).pipe(
    Effect.catchTags({ OperationFailed: (failure) => skipDeadKey({ failure }) }),
  );
});

/** Revokes the replaced login's key with that key, and says so. */
const revokeLoginKey = Effect.fn('revokeLoginKey')(function* ({
  call,
  replaced,
}: RevokeLoginKeyInput): Effect.fn.Return<void, ClientFailure> {
  const { key, token } = replaced;

  yield* call({ name: 'revokeKey', input: { keyId: key.id }, credential: token });

  writeDiagnostic({ program: PROGRAM, line: `revoked the login key ${key.id} that this login replaced` });
});
