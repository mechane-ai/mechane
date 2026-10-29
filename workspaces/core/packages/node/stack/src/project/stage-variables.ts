import { WORKER_VARIABLES } from '@mechane/deployment';
import { PrivateMode, StepSubject } from '@mechane/program';
import { Effect, Option, Record } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StackStep, STAGED_FILES } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackVariables } from '../types.ts';
import { variableLine } from './variable-line.ts';

type StageVariablesInput = { readonly projectFolder: string; readonly variables: StackVariables };

/** A Worker variable's field of the settings, and the name the Worker reads it under. */
type WorkerVariable = readonly [keyof typeof WORKER_VARIABLES, string];

/** Writes the project's `.dev.vars`, which only its owner may read, with each variable the stack sets. */
export const stageVariables = Effect.fn('stageVariables')(function* ({
  projectFolder,
  variables,
}: StageVariablesInput): Effect.fn.Return<void, StackFailed> {
  const stagedLine = Effect.fn('stagedLine')(function* ([field, name]: WorkerVariable): Effect.fn.Return<
    string,
    StackFailed
  > {
    const value = Option.fromNullishOr(variables[field]);

    if (Option.isNone(value)) {
      return '';
    }

    return yield* variableLine({ name, value: value.value });
  });

  const entries = Record.toEntries(WORKER_VARIABLES);
  const lines = yield* Effect.forEach(entries, stagedLine, { concurrency: 1 });
  const text = lines.join('');
  const path = join(projectFolder, STAGED_FILES.variables);
  const subjects = [StepSubject.cases.Path.make({ path })];

  yield* Effect.tryPromise({
    try: () => writeFile(path, text, { mode: PrivateMode.File }),
    catch: (cause) => new StackFailed({ step: StackStep.WriteVariables, subjects, reason: String(cause) }),
  });
});
