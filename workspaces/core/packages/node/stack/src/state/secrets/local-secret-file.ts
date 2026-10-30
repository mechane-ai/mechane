import { createFile, PrivateMode, readOptionalFile, StepSubject } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { StackStep } from '../../constants.ts';
import { StackFailed } from '../../errors.ts';

type LocalSecretFileInput<S> = {
  readonly path: string;
  readonly schema: S;
  readonly create: () => string;
  readonly invalidReason: string;
};

/** Retained secrets are validated on every start and created privately only when absent. */
export const localSecretFile = Effect.fn('localSecretFile')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  schema,
  create,
  invalidReason,
}: LocalSecretFileInput<S>): Effect.fn.Return<string, StackFailed, Scope.Scope> {
  const subjects = [StepSubject.cases.Path.make({ path })];

  const existing = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step: StackStep.ReadLocalState, subjects, reason: failure.reason })),
  );

  if (Option.isSome(existing)) {
    const secret = existing.value.trim();

    yield* Schema.decodeUnknownEffect(schema)(secret).pipe(
      Effect.mapError(() => new StackFailed({ step: StackStep.ReadLocalState, subjects, reason: invalidReason })),
    );

    return secret;
  }

  const secret = create();

  yield* createFile({ path, contents: `${secret}\n`, mode: PrivateMode.File }).pipe(
    Effect.mapError(
      (failure) => new StackFailed({ step: StackStep.WriteLocalState, subjects, reason: failure.reason }),
    ),
  );

  return secret;
});
