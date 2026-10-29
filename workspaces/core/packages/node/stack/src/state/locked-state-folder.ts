import { PrivateMode, StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { lockStateFolder } from './store/lock-state-folder.ts';

type LockedStateFolderInput = { readonly path: string };

/** Resolves the state directory and holds its exclusive process lock until the scope closes. */
export const lockedStateFolder = Effect.fn('lockedStateFolder')(function* ({
  path,
}: LockedStateFolderInput): Effect.fn.Return<string, StackFailed, Scope.Scope> {
  const step = StackStep.LockLocalState;
  const subjects = [StepSubject.cases.Path.make({ path })];

  if (!isAbsolute(path)) {
    return yield* new StackFailed({ step, subjects, reason: 'MECHANE_LOCAL_STATE_DIR must be an absolute path' });
  }

  yield* Effect.tryPromise({
    try: () => mkdir(path, { recursive: true, mode: PrivateMode.Folder }),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  const stateFolder = yield* Effect.tryPromise({
    try: () => realpath(path),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  yield* lockStateFolder({ stateFolder });

  return stateFolder;
});
