import type { Lock, LockPair } from '@mechane/program';
import { Array, Option, Record } from 'effect';

/**
 * The lock with each entry the source declares that it does not hold appended to its key, in the source's order. It
 * keeps every entry it holds, so a lost one stays for the check to report.
 */
export function appendedLock({ locked, current }: LockPair): Lock {
  const keys = [...new Set([...Record.keys(locked), ...Record.keys(current)])];

  /** A key's entries: those the lock holds, then those the source declares that it does not. */
  const keyEntries: (key: string) => readonly [string, ReadonlyArray<string>] = (key) => {
    const held = Option.getOrElse(Record.get(locked, key), () => []);
    const declared = Option.getOrElse(Record.get(current, key), () => []);

    return [key, [...held, ...Array.difference(declared, held)]];
  };

  return Record.fromEntries(keys.map(keyEntries));
}
