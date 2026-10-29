import { Option, Record } from 'effect';
import type { SiteCounts } from '../types.ts';

type ScopedFilesInput = {
  readonly found: SiteCounts;
  readonly allowed: SiteCounts;
  /** The files a command checked; absent when it checked every file. */
  readonly scope: Option.Option<ReadonlySet<string>>;
};

/** The files a ratchet's sites or its baseline name, in `scope`, sorted. */
export function scopedFiles({ found, allowed, scope }: ScopedFilesInput): ReadonlyArray<string> {
  /** Whether the command checked the file: every file is checked when `scope` is absent. */
  const isInScope: (file: string) => boolean = (file) =>
    Option.match(scope, { onNone: () => true, onSome: (named) => named.has(file) });

  return [...new Set([...Record.keys(found), ...Record.keys(allowed)])].filter(isInScope).toSorted();
}
