import { Number, Option, Record } from 'effect';
import type { SiteCounts } from '../types.ts';

/** A file's count, under the path it holds now. */
type CarriedCount = { readonly path: string; readonly count: number };

type CarriedCountsInput = { readonly held: SiteCounts; readonly renames: ReadonlyMap<string, string> };

/**
 * The counts with each file git reports renamed under its new path. Files renamed to one path, such as a file that a
 * move map's declaration move empties into another as both move, hold their counts' sum there.
 */
export function carriedCounts({ held, renames }: CarriedCountsInput): SiteCounts {
  const carriedCount: (entry: readonly [file: string, count: number]) => CarriedCount = ([file, count]) => ({
    path: Option.getOrElse(Option.fromNullishOr(renames.get(file)), () => file),
    count,
  });

  const carried = Record.toEntries(held).map(carriedCount);

  /** One path's count: the sum of the counts carried to it. */
  const pathCount: (
    entry: readonly [path: string, group: ReadonlyArray<CarriedCount>],
  ) => readonly [string, number] = ([path, group]) => {
    const counts = group.map(({ count }) => count);

    return [path, Number.sumAll(counts)];
  };

  return Record.fromEntries([...Map.groupBy(carried, ({ path }) => path)].map(pathCount));
}
