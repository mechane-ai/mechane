import { Array, Effect } from 'effect';
import type { InputUnreadable } from '../../errors.ts';
import { gitLines } from '../../workspace/git-lines.ts';
import { trackedFiles } from '../../workspace/tracked-files.ts';
import { mappedPath } from './mapped-path.ts';
import { readMoveMap } from './read-move-map.ts';

/** A file's path at the merge base, and its path after every step of the map. */
type MappedRename = readonly [from: string, to: string];

/** The merge base `base` whose files the map may move, and the variables git inherits. */
type MappedRenamesInput = { readonly base: string; readonly inherited: Readonly<Record<string, string>> };

/**
 * Each file of the merge base `base` that the committed move map moves and the working tree holds only at its new path,
 * by its old path. A step that also moves declarations can change a file past what git's rename detection matches,
 * while the map records the rename all the same.
 */
export const mappedRenames = Effect.fn('mappedRenames')(function* ({
  base,
  inherited,
}: MappedRenamesInput): Effect.fn.Return<ReadonlyMap<string, string>, InputUnreadable> {
  const steps = yield* readMoveMap();
  const present: ReadonlySet<string> = new Set(yield* trackedFiles({ inherited }));
  const before = yield* gitLines({ args: ['ls-tree', '-r', '--name-only', base], inherited });
  const mappedRename: (path: string) => MappedRename = (path) => [path, mappedPath({ steps, path })];
  const isPresentMove: (rename: MappedRename) => boolean = ([from, to]) => from !== to && present.has(to);

  return new Map(Array.difference(before, present).map(mappedRename).filter(isPresentMove));
});
