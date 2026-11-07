import { Option, Record } from 'effect';
import { sep } from 'node:path';
import type { SiteCounts } from '../types.ts';

type ScopedFilesInput = {
  readonly found: SiteCounts;
  readonly allowed: SiteCounts;
  /** The files or directories a command checked; absent when it checked every file. */
  readonly scope: Option.Option<ReadonlySet<string>>;
};

/** The files a ratchet's sites or its baseline name, in `scope`, sorted. */
export function scopedFiles({ found, allowed, scope }: ScopedFilesInput): ReadonlyArray<string> {
  const isInScope: (file: string) => boolean = (file) =>
    Option.match(scope, {
      onNone: () => true,
      onSome: (named) => {
        const paths = Array.from(named);

        return paths.some((path) => path.length === 0 || file === path || file.startsWith(path + sep));
      },
    });

  return [...new Set([...Record.keys(found), ...Record.keys(allowed)])].filter(isInScope).toSorted();
}
