import { join } from 'node:path';
import { CELLD_OBJECTS_FOLDER, STATE_LAYOUT } from '../constants.ts';
import type { StateLayout } from '../types.ts';

type StateLayoutInput = { readonly stateFolder: string };

/** Names the runtime, logs, and sandbox folders within one installation’s state directory. */
export function stateLayout({ stateFolder }: StateLayoutInput): StateLayout {
  const projectFolder = join(stateFolder, STATE_LAYOUT.project);

  return {
    stateFolder,
    projectFolder,
    sandboxesFolder: join(stateFolder, STATE_LAYOUT.sandboxes),
    logFile: join(stateFolder, STATE_LAYOUT.log),
    storageFolder: join(projectFolder, ...CELLD_OBJECTS_FOLDER),
  };
}
