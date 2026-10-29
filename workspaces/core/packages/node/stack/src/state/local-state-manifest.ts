import { createFile, jsonFileText, PrivateMode, readOptionalFile, StepSubject } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { LOCAL_APPLICATION, LOCAL_FILES } from './constants.ts';
import { localStateEntries } from './local-state-entries.ts';
import { LocalState, LocalStateJson } from './schemas.ts';

type LocalStateManifestInput = { readonly stateFolder: string; readonly origin: URL };

/** Binds a new installation to its origin and refuses a changed origin or an unrelated directory. */
export const localStateManifest = Effect.fn('localStateManifest')(function* ({
  stateFolder,
  origin,
}: LocalStateManifestInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const path = join(stateFolder, LOCAL_FILES.manifest);
  const subjects = [StepSubject.cases.Path.make({ path })];
  const step = StackStep.ReadLocalState;

  const contents = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step, subjects, reason: failure.reason })),
  );

  if (Option.isSome(contents)) {
    const manifest = yield* Schema.decodeUnknownEffect(LocalStateJson)(contents.value).pipe(
      Effect.mapError(() => new StackFailed({ step, subjects, reason: 'the local state manifest is invalid' })),
    );

    if (manifest.origin.origin !== origin.origin) {
      return yield* new StackFailed({
        step,
        subjects,
        reason: `this state belongs to ${manifest.origin.origin}; keep MECHANE_LOCAL_ORIGIN unchanged`,
      });
    }

    return;
  }

  yield* initializeLocalState({ stateFolder, origin });
});

const initializeLocalState = Effect.fn('initializeLocalState')(function* ({
  stateFolder,
  origin,
}: LocalStateManifestInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const step = StackStep.WriteLocalState;
  const subjects = [StepSubject.cases.Path.make({ path: stateFolder })];

  const entries = yield* localStateEntries({ stateFolder, step });

  if (entries.length > 0) {
    return yield* new StackFailed({
      step,
      subjects,
      reason: 'the directory is not empty and has no Mechane state manifest',
    });
  }

  const path = join(stateFolder, LOCAL_FILES.manifest);
  const contents = jsonFileText({ schema: LocalState, value: { application: LOCAL_APPLICATION, origin } });

  yield* createFile({ path, contents, mode: PrivateMode.File }).pipe(
    Effect.mapError((failure) => new StackFailed({ step, subjects, reason: failure.reason })),
  );
});
