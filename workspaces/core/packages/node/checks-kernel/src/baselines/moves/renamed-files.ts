import { Array, Effect, Option } from 'effect';
import { mkdir } from 'node:fs/promises';
import { CACHE_FOLDER } from '../../constants.ts';
import { FileUnwritable } from '../../errors.ts';
import type { ChecksFailure } from '../../types.ts';
import { gitLines } from '../../workspace/git-lines.ts';
import { mappedRenames } from './mapped-renames.ts';

/** The copy of `HEAD`'s index, in the checks' ignored cache, where the rename diff adds the untracked files. */
const RENAMES_INDEX = `${CACHE_FOLDER}renames-index`;

/** The field of a rename's line in `git diff --name-status`, split at its tabs, that holds its path before. */
const RENAME_FROM_FIELD = 1;

/** The field of a rename's line that holds its path after, which follows the path before. */
const RENAME_TO_FIELD = 2;

/** The merge base `base` whose renames a diff reports, and the variables git inherits. */
type RenamedFilesInput = { readonly base: string; readonly inherited: Readonly<Record<string, string>> };

/**
 * Each rename git reports between the merge base `base` and the working tree, committed, staged or neither, from its
 * old path to its new one, relative to the workspace. Each rename the move map records counts too, as does a file moved
 * without git. The diff reads a copy of `HEAD`'s index that marks each untracked file as one git will add.
 */
export const renamedFiles = Effect.fn('renamedFiles')(function* ({
  base,
  inherited,
}: RenamedFilesInput): Effect.fn.Return<ReadonlyMap<string, string>, ChecksFailure> {
  const withIndex = { ...inherited, GIT_INDEX_FILE: RENAMES_INDEX };

  yield* Effect.tryPromise({
    try: () => mkdir(CACHE_FOLDER, { recursive: true }),
    catch: (cause) => new FileUnwritable({ path: CACHE_FOLDER, reason: String(cause) }),
  });
  yield* gitLines({ args: ['read-tree', 'HEAD'], inherited: withIndex });
  yield* gitLines({ args: ['add', '--intent-to-add', '.'], inherited: withIndex });

  const lines = yield* gitLines({
    args: ['diff', '-M', '--name-status', '--diff-filter=R', '--relative', base],
    inherited: withIndex,
  });

  /** A rename's line, as its path before and its path after. */
  const detectedRename: (line: string) => ReadonlyArray<readonly [string, string]> = (line) => {
    const fields = line.split('\t');

    return Option.toArray(Option.all([Array.get(fields, RENAME_FROM_FIELD), Array.get(fields, RENAME_TO_FIELD)]));
  };

  const mapped = yield* mappedRenames({ base, inherited });

  return new Map([...lines.flatMap(detectedRename), ...mapped]);
});
