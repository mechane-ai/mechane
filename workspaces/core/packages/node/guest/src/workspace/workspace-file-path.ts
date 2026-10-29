import type { RecordId } from '@mechane/records';
import { join } from 'node:path';

type WorkspaceFilePathInput = { readonly folder: string; readonly generation: RecordId; readonly file: string };

/** Builds a generation file path inside the guest-owned archive scratch directory. */
export function workspaceFilePath({ folder, generation, file }: WorkspaceFilePathInput): string {
  const directory = join(folder, generation);

  return join(directory, file);
}
