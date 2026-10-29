import { decodeFile } from '@mechane/checks-kernel';
import type { CheckInput, Finding, InputUnreadable } from '@mechane/checks-kernel';
import { Lock, MIGRATION_LOCK, WIRE_LOCK } from '@mechane/program';
import { Effect } from 'effect';
import { recordFormFindings } from './fields/record-form-findings.ts';
import { lockFindings } from './lock-findings.ts';
import { migrationHashes } from './migration-hashes.ts';
import { tableFindings } from './table-findings.ts';
import { wireNames } from './wire-names.ts';

/**
 * Checks the wire lock and the migration lock against the source, so a shipped name or a migration only appends. It
 * also checks each answer's fields against their record forms, and the stored-name rule's tables against the migrations
 * the parsed stores declare.
 */
export const checkLocks = Effect.fn('checkLocks')(function* ({
  sources,
}: CheckInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const wire = lockFindings({
    path: WIRE_LOCK,
    locked: yield* decodeFile({ path: WIRE_LOCK, schema: Lock }),
    current: yield* wireNames(),
  });

  const migrations = lockFindings({
    path: MIGRATION_LOCK,
    locked: yield* decodeFile({ path: MIGRATION_LOCK, schema: Lock }),
    current: yield* migrationHashes(),
  });

  const tables = yield* tableFindings({ sources });

  return [...wire, ...migrations, ...recordFormFindings(), ...tables];
});
