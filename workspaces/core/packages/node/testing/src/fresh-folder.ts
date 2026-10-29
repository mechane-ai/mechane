import { Effect } from 'effect';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStep } from './constants.ts';
import { FileStepFailed } from './errors.ts';
import type { StackInput } from './types.ts';

/** The stack, and how the name of the folder made in its state folder starts. */
type FreshFolderInput = StackInput & { readonly prefix: string };

/** A fresh folder in the stack's state folder, named for the prefix and a random suffix, which a failed run keeps. */
export const freshFolder = Effect.fn('freshFolder')(function* ({
  stack,
  prefix,
}: FreshFolderInput): Effect.fn.Return<string, FileStepFailed> {
  const start = join(stack.stateFolder, prefix);

  return yield* Effect.tryPromise({
    try: () => mkdtemp(start),
    catch: (cause) => new FileStepFailed({ step: FileStep.Create, path: stack.stateFolder, reason: String(cause) }),
  });
});
