import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Option } from 'effect';
import { join } from 'node:path';
import type { StringRename } from '../types.ts';

/** A wire string's rename, and one file of the factory. */
type IsAppliedInput = { readonly rename: StringRename; readonly path: string };

/** Whether the rename rewrites the file: any file, or only one in the folder its `within` names. */
export function isApplied({ rename, path }: IsAppliedInput): boolean {
  /** Whether the folder, relative to the workspace, holds the file. */
  const isWithin: (within: string) => boolean = (within) => path.startsWith(join(WORKSPACE_FOLDER, within));

  return Option.match(rename.within, { onNone: () => true, onSome: isWithin });
}
