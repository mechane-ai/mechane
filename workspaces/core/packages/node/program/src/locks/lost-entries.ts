import { Array, Option, Record } from 'effect';
import type { LockPair } from '../types.ts';

/** One entry of a lock, under its key. */
type LockEntry = { readonly key: string; readonly entry: string };

/**
 * Each entry of the locked lock that the current one lacks: a shipped name or schema step renamed, edited or removed.
 * An entry only ever joins a lock.
 */
export function lostEntries({ locked, current }: LockPair): ReadonlyArray<LockEntry> {
  const lostOfKey: (pair: readonly [string, ReadonlyArray<string>]) => ReadonlyArray<LockEntry> = ([key, entries]) => {
    const kept = Option.getOrElse(Record.get(current, key), () => []);

    return Array.difference(entries, kept).map((entry) => ({ key, entry }));
  };

  return Record.toEntries(locked).flatMap(lostOfKey);
}
