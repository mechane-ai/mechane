import { Array, Effect } from 'effect';
import type { InputUnreadable } from '../errors.ts';
import type { InheritedInput } from '../types.ts';
import { gitLines } from './git-lines.ts';

/** Every file of the workspace that git tracks or would track, sorted, leaving out tracked files deleted on disk. */
export const trackedFiles = Effect.fn('trackedFiles')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const listed = yield* gitLines({ args: ['ls-files', '--cached', '--others', '--exclude-standard'], inherited });
  const deleted = yield* gitLines({ args: ['ls-files', '--deleted'], inherited });

  // git lists a path with a merge conflict once for each of its stages.
  return Array.difference(new Set(listed), deleted).toSorted();
});
