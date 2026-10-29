import { decodeFile, FileUnwritable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { ChecksFailure, Finding, InputUnreadable } from '@mechane/checks-kernel';
import { JSON_INDENT_CHARS, Lock, MIGRATION_LOCK, WIRE_LOCK } from '@mechane/program';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { appendedLock } from './appended-lock.ts';
import { migrationHashes } from './migration-hashes.ts';
import { wireNames } from './wire-names.ts';

/** A lock's file, and the entries the source declares now. */
type AppendLockInput = { readonly path: string; readonly current: Effect.Effect<Lock, InputUnreadable> };

/**
 * Appends to the wire lock and the migration lock what the source declares and they do not hold yet; it reports no
 * findings.
 */
export const appendLocks = Effect.fn('appendLocks')(function* (): Effect.fn.Return<
  ReadonlyArray<Finding>,
  ChecksFailure
> {
  yield* appendLock({ path: WIRE_LOCK, current: wireNames() });
  yield* appendLock({ path: MIGRATION_LOCK, current: migrationHashes() });

  return [];
});

/**
 * Writes the lock with the new entries appended, one entry a line. Two branches that append to one key conflict at its
 * last entry's comma, so a merge takes either side and runs the lock task again.
 */
const appendLock = Effect.fn('appendLock')(function* ({
  path,
  current,
}: AppendLockInput): Effect.fn.Return<void, ChecksFailure> {
  const locked = yield* decodeFile({ path, schema: Lock });
  const lock = appendedLock({ locked, current: yield* current });
  const absolute = resolve(WORKSPACE_FOLDER, path);
  const text = `${JSON.stringify(lock, null, JSON_INDENT_CHARS)}\n`;

  yield* Effect.tryPromise({
    try: () => writeFile(absolute, text),
    catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
  });
});
