import { SHA256_PATTERN } from '@mechane/records';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { SECRET_BYTES } from '../../constants.ts';
import type { StackFailed } from '../../errors.ts';
import { localSecretFile } from './local-secret-file.ts';

const secretPattern = Schema.isPattern(SHA256_PATTERN);

/** The bootstrap credential’s 32 random bytes written as lowercase hexadecimal. */
const BootstrapSecret = Schema.String.check(secretPattern);

type BootstrapSecret = typeof BootstrapSecret.Type;

type LocalBootstrapSecretInput = { readonly path: string };

/** Reads the retained bootstrap credential or creates it privately on the installation’s first start. */
export const localBootstrapSecret = Effect.fn('localBootstrapSecret')(function* ({
  path,
}: LocalBootstrapSecretInput): Effect.fn.Return<string, StackFailed, Scope.Scope> {
  const create: () => string = () => randomBytes(SECRET_BYTES).toString('hex');

  return yield* localSecretFile({
    path,
    schema: BootstrapSecret,
    create,
    invalidReason: 'the bootstrap secret file is invalid',
  });
});
