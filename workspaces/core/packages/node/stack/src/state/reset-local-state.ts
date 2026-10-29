import { StepSubject } from '@mechane/program';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyCelldStopped } from '../celld/verify-celld-stopped.ts';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { LOCAL_FILES } from './constants.ts';
import { localStateEntries } from './local-state-entries.ts';
import { lockedStateFolder } from './locked-state-folder.ts';
import { LocalStateJson } from './schemas.ts';
import { stateLayout } from './state-layout.ts';

type ResetLocalStateInput = { readonly path: string };
type EmptyLocalStateInput = { readonly stateFolder: string };

/** Erases a recognized installation only after acquiring its lock and proving its celld processes have stopped. */
export const resetLocalState = Effect.fn('resetLocalState')(function* ({
  path,
}: ResetLocalStateInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const stateFolder = yield* lockedStateFolder({ path });
  const layout = stateLayout({ stateFolder });

  yield* verifyCelldStopped({ projectFolder: layout.projectFolder });

  const manifestFile = join(stateFolder, LOCAL_FILES.manifest);
  const step = StackStep.ResetLocalState;
  const subjects = [StepSubject.cases.Path.make({ path: stateFolder })];

  const manifestText = yield* Effect.tryPromise({
    try: () => readFile(manifestFile, 'utf8'),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  yield* Schema.decodeUnknownEffect(LocalStateJson)(manifestText).pipe(
    Effect.mapError(() => new StackFailed({ step, subjects, reason: 'the local state manifest is invalid' })),
  );

  yield* emptyLocalState({ stateFolder });
});

const emptyLocalState = Effect.fn('emptyLocalState')(function* ({
  stateFolder,
}: EmptyLocalStateInput): Effect.fn.Return<void, StackFailed> {
  const step = StackStep.ResetLocalState;
  const subjects = [StepSubject.cases.Path.make({ path: stateFolder })];

  const removed = yield* localStateEntries({ stateFolder, step });

  const removeEntry = Effect.fn('removeEntry')(function* (entry: string): Effect.fn.Return<void, StackFailed> {
    const path = join(stateFolder, entry);

    yield* Effect.tryPromise({
      try: () => rm(path, { recursive: true, force: true }),
      catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
    });
  });

  yield* Effect.forEach(removed, removeEntry, { concurrency: 1, discard: true });
});
