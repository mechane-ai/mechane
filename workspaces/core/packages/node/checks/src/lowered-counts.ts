import type { SiteCounts } from '@mechane/checks-kernel';
import { Option, Record } from 'effect';

/** A baseline's ceiling, and the counts the tree's sites give. */
type LoweredCountsInput = { readonly held: SiteCounts; readonly found: SiteCounts };

/** A file and its count. */
type CountEntry = readonly [file: string, count: number];

/** Each file's smaller count, of its ceiling's and of its sites; a file the ceiling does not list keeps none. */
export function loweredCounts({ held, found }: LoweredCountsInput): SiteCounts {
  /** A file's entry at the smaller of its two counts, or none when the ceiling does not list the file. */
  const loweredEntry: (entry: CountEntry) => ReadonlyArray<CountEntry> = ([file, count]) => {
    const allowed = Record.get(held, file);

    if (Option.isNone(allowed)) {
      return [];
    }

    return [[file, Math.min(count, allowed.value)]];
  };

  return Record.fromEntries(Record.toEntries(found).flatMap(loweredEntry));
}
