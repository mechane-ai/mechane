import { Effect } from 'effect';
import { join } from 'node:path';
import { removeState } from '../state/remove-state.ts';
import { CELLD_OWNER_FILE } from './constants.ts';

type RemoveCelldOwnerInput = { readonly projectFolder: string };

/** Removes the ownership record after its runtime has stopped. */
export const removeCelldOwner = Effect.fn('removeCelldOwner')(function* ({
  projectFolder,
}: RemoveCelldOwnerInput): Effect.fn.Return<void> {
  const path = join(projectFolder, CELLD_OWNER_FILE);

  yield* removeState({ path, isRecursive: false });
});
