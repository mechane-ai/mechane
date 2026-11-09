import { decodeFile } from '@mechane/checks-kernel';
import type { CheckInput, Finding, InputUnreadable } from '@mechane/checks-kernel';
import { Lock, MIGRATION_LOCK, SHIPPED_WIRE_LOCK, WIRE_LOCK } from '@mechane/program';
import { Effect } from 'effect';
import { recordFormFindings } from './fields/record-form-findings.ts';
import { lockFindings } from './lock-findings.ts';
import { migrationHashes } from './migration-hashes.ts';
import { shippedWireFindings } from './shipped-wire-findings.ts';
import { tableFindings } from './table-findings.ts';
import { wireNames } from './wire-names.ts';

type CheckLocksInput = CheckInput & {
  readonly baseBranch: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Checks the active catalog against source and preserves cumulative shipped history independently of retired APIs.
 * Migration steps, record forms, and stored-name tables remain checked against their owning declarations.
 */
export const checkLocks = Effect.fn('checkLocks')(function* ({
  sources,
  baseBranch,
  inherited,
}: CheckLocksInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const current = yield* wireNames();

  const wire = lockFindings({ path: WIRE_LOCK, locked: yield* decodeFile({ path: WIRE_LOCK, schema: Lock }), current });

  const shipped = yield* shippedWireFindings({
    current,
    shipped: yield* decodeFile({ path: SHIPPED_WIRE_LOCK, schema: Lock }),
    baseBranch,
    inherited,
  });

  const migrations = lockFindings({
    path: MIGRATION_LOCK,
    locked: yield* decodeFile({ path: MIGRATION_LOCK, schema: Lock }),
    current: yield* migrationHashes(),
  });

  const tables = yield* tableFindings({ sources });

  return [...wire, ...shipped, ...migrations, ...recordFormFindings(), ...tables];
});
