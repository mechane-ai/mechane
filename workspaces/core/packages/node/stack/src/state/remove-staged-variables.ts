import { Effect } from 'effect';
import { join } from 'node:path';
import { STAGED_VARIABLE_FILES } from '../constants.ts';
import { removeState } from './remove-state.ts';

type RemoveStagedVariablesInput = { readonly stateFolder: string };

/** Removes the files of a kept state folder that hold the staged variables, which can hold a person's model key. */
export const removeStagedVariables = Effect.fn('removeStagedVariables')(function* ({
  stateFolder,
}: RemoveStagedVariablesInput): Effect.fn.Return<void> {
  const paths = STAGED_VARIABLE_FILES.map((parts) => join(stateFolder, ...parts));

  yield* Effect.forEach(paths, (path) => removeState({ path, isRecursive: false }), {
    concurrency: 'unbounded',
    discard: true,
  });
});
