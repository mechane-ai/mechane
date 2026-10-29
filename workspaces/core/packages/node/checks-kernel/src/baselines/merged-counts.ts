import { Option, Record } from 'effect';
import type { SiteCounts } from '../types.ts';

/** The three versions of a baseline a merge compares, each as the counts it holds. */
type MergedCountsInput = { readonly ancestor: SiteCounts; readonly ours: SiteCounts; readonly theirs: SiteCounts };

/** One side of a merge, the ancestor it started from, and the file whose count it gives. */
type SideCountInput = { readonly ancestor: SiteCounts; readonly side: SiteCounts; readonly file: string };

/** Each file's smallest count among the sides that hold an opinion on it, kept while it stays above zero. */
export function mergedCounts({ ancestor, ours, theirs }: MergedCountsInput): SiteCounts {
  const files = [...new Set([...Record.keys(ours), ...Record.keys(theirs)])];

  /** A file's merged count, none once it falls to zero. */
  const fileCount: (file: string) => ReadonlyArray<readonly [string, number]> = (file) => {
    const sideCounts: (side: SiteCounts) => ReadonlyArray<number> = (side) =>
      Option.toArray(sideCount({ ancestor, side, file }));

    const smallest = Math.min(...[ours, theirs].flatMap(sideCounts));

    return Option.toArray(Option.liftPredicate(smallest, (count) => count > 0)).map((count) => [file, count] as const);
  };

  return Record.fromEntries(files.flatMap(fileCount));
}

/** One side's count of a file: its own, zero when it dropped one the ancestor held, or none when it never held it. */
function sideCount({ ancestor, side, file }: SideCountInput): Option.Option<number> {
  const dropped: () => Option.Option<number> = () => Option.map(Record.get(ancestor, file), () => 0);

  return Option.orElse(Record.get(side, file), dropped);
}
