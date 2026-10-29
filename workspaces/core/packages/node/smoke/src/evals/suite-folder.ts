import type { Stack } from '@mechane/stack';
import { FileStep, FileStepFailed, freshFolder } from '@mechane/testing';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EvalPath, SUITE } from './constants.ts';

/** The prefix of the scenario's folder in the stack's state folder, which holds the suite and the out folder. */
const EVAL_FOLDER_PREFIX = 'eval-';

/** The stack a helper works on. */
type StackInput = { readonly stack: Stack };

/** A fresh folder in the stack's state folder, which a failed run keeps, holding the scenario's suite. */
export const suiteFolder = Effect.fn('suiteFolder')(function* ({
  stack,
}: StackInput): Effect.fn.Return<string, FileStepFailed> {
  const folder = yield* freshFolder({ stack, prefix: EVAL_FOLDER_PREFIX });
  const suite = join(folder, EvalPath.Suite);
  const text = JSON.stringify(SUITE);

  yield* Effect.tryPromise({
    try: () => writeFile(suite, text),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: suite, reason: String(cause) }),
  });

  return folder;
});
