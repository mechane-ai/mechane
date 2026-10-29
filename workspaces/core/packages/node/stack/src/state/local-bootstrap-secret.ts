import { createFile, PrivateMode, readOptionalFile, StepSubject } from '@mechane/program';
import { SHA256_PATTERN } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { SECRET_BYTES, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

const secretPattern = Schema.isPattern(SHA256_PATTERN);

/** The bootstrap credential’s 32 random bytes written as lowercase hexadecimal. */
const BootstrapSecret = Schema.String.check(secretPattern);

type BootstrapSecret = typeof BootstrapSecret.Type;

type LocalBootstrapSecretInput = { readonly path: string };

/** Reads the retained bootstrap credential or creates it privately on the installation’s first start. */
export const localBootstrapSecret = Effect.fn('localBootstrapSecret')(function* ({
  path,
}: LocalBootstrapSecretInput): Effect.fn.Return<string, StackFailed, Scope.Scope> {
  const subjects = [StepSubject.cases.Path.make({ path })];

  const existing = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step: StackStep.ReadLocalState, subjects, reason: failure.reason })),
  );

  if (Option.isSome(existing)) {
    const secret = existing.value.trim();

    return yield* Schema.decodeUnknownEffect(BootstrapSecret)(secret).pipe(
      Effect.mapError(
        () =>
          new StackFailed({ step: StackStep.ReadLocalState, subjects, reason: 'the bootstrap secret file is invalid' }),
      ),
    );
  }

  const secret = randomBytes(SECRET_BYTES).toString('hex');

  yield* createFile({ path, contents: `${secret}\n`, mode: PrivateMode.File }).pipe(
    Effect.mapError(
      (failure) => new StackFailed({ step: StackStep.WriteLocalState, subjects, reason: failure.reason }),
    ),
  );

  return secret;
});
