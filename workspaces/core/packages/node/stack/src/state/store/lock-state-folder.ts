import { StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { StackStep } from '../../constants.ts';
import { StackFailed } from '../../errors.ts';
import { closeDatabase } from '../../releases/store/close-database.ts';
import { LOCAL_FILES } from '../constants.ts';

type LockStateFolderInput = { readonly stateFolder: string };
type OpenStateLockInput = { readonly path: string };

/** Holds an exclusive SQLite transaction whose process lock the operating system releases after a crash. */
export const lockStateFolder = Effect.fn('lockStateFolder')(function* ({
  stateFolder,
}: LockStateFolderInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const path = join(stateFolder, LOCAL_FILES.lock);
  const step = StackStep.LockLocalState;
  const subjects = [StepSubject.cases.Path.make({ path: stateFolder })];

  const open = Effect.try({
    try: () => openStateLock({ path }),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  const database = yield* Effect.acquireRelease(open, (opened) => closeDatabase({ database: opened, path }));

  yield* Effect.try({
    try: () => database.exec('BEGIN EXCLUSIVE'),
    catch: () =>
      new StackFailed({ step, subjects, reason: 'another local stack or reset already owns this directory' }),
  });
});

function openStateLock({ path }: OpenStateLockInput): DatabaseSync {
  return new DatabaseSync(path, { timeout: 0 });
}
