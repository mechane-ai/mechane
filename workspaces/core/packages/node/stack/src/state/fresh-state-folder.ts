import { StepSubject } from '@mechane/program';
import { Effect, Exit } from 'effect';
import type { Scope } from 'effect';
import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { StackStep, STATE_LAYOUT } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StateLayout } from '../types.ts';
import { removeStagedVariables } from './remove-staged-variables.ts';
import { removeState } from './remove-state.ts';
import { stateLayout } from './state-layout.ts';

type FreshStateFolderInput = { readonly stateRoot: string };

/**
 * A new state folder with its project and sandboxes folders, and the paths of its parts. An interrupted scope, such as
 * one a stop signal ends, removes the folder as a passing one does. A failed one keeps it, without the staged
 * variables.
 */
export const freshStateFolder = Effect.fn('freshStateFolder')(function* ({
  stateRoot,
}: FreshStateFolderInput): Effect.fn.Return<StateLayout, StackFailed, Scope.Scope> {
  const step = StackStep.CreateStateFolder;
  const subjects = [StepSubject.cases.Path.make({ path: stateRoot })];

  // A host shell resolves aliases such as macOS's /var to /private/var before reporting its home.
  const canonicalRoot = yield* Effect.tryPromise({
    try: () => realpath(stateRoot),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  const release: (layout: StateLayout, exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void> = (
    { stateFolder },
    exit,
  ) => {
    if (Exit.isFailure(exit) && !Exit.hasInterrupts(exit)) {
      return removeStagedVariables({ stateFolder });
    }

    return removeState({ path: stateFolder, isRecursive: true });
  };

  return yield* Effect.acquireRelease(createStateFolder({ stateRoot: canonicalRoot }), release);
});

/** Creates a new state folder below the state root with its project and sandboxes folders, and answers its layout. */
const createStateFolder = Effect.fn('createStateFolder')(function* ({
  stateRoot,
}: FreshStateFolderInput): Effect.fn.Return<StateLayout, StackFailed> {
  const step = StackStep.CreateStateFolder;
  const prefix = join(stateRoot, STATE_LAYOUT.prefix);
  const rootSubjects = [StepSubject.cases.Path.make({ path: stateRoot })];

  const stateFolder = yield* Effect.tryPromise({
    try: () => mkdtemp(prefix),
    catch: (cause) => new StackFailed({ step, subjects: rootSubjects, reason: String(cause) }),
  });

  const projectFolder = join(stateFolder, STATE_LAYOUT.project);
  const sandboxesFolder = join(stateFolder, STATE_LAYOUT.sandboxes);
  const projectSubjects = [StepSubject.cases.Path.make({ path: projectFolder })];
  const sandboxesSubjects = [StepSubject.cases.Path.make({ path: sandboxesFolder })];

  yield* Effect.tryPromise({
    try: () => mkdir(projectFolder),
    catch: (cause) => new StackFailed({ step, subjects: projectSubjects, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => mkdir(sandboxesFolder),
    catch: (cause) => new StackFailed({ step, subjects: sandboxesSubjects, reason: String(cause) }),
  });

  return stateLayout({ stateFolder });
});
