import { decodeFirst, rowCount } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { LeaseRow } from '../schemas.ts';
import type { HoldLeaseInput, LeaseInput, MachineLeaseRecords, NowInput } from '../types.ts';

/** The leases of the machines the workspace's sandboxes run, one per sandbox until it expires. */
export function machineLeaseRecords({ sql }: RecordsInput): MachineLeaseRecords {
  return {
    dropExpiredLeases: (input) => dropExpiredLeases({ sql, ...input }),
    sandboxLease: (input) => sandboxLease({ sql, ...input }),
    leaseCount: () => leaseCount({ sql }),
    holdLease: (input) => holdLease({ sql, ...input }),
    releaseLease: (input) => releaseLease({ sql, ...input }),
  };
}

function dropExpiredLeases({ sql, now }: SqlCall<NowInput>): void {
  sql.exec('DELETE FROM leases WHERE expires_at_ms <= ?', DateTime.toEpochMillis(now));
}

function sandboxLease({ sql, sandboxId }: SqlCall<LeaseInput>): Option.Option<LeaseRow> {
  const cursor = sql.exec('SELECT expires_at_ms FROM leases WHERE sandbox_id = ?', sandboxId);

  return decodeFirst({ cursor, schema: LeaseRow });
}

function leaseCount({ sql }: RecordsInput): number {
  return rowCount({ cursor: sql.exec('SELECT COUNT(*) AS count FROM leases') });
}

function holdLease({ sql, sandboxId, expiresAt }: SqlCall<HoldLeaseInput>): void {
  sql.exec(
    'INSERT INTO leases (sandbox_id, expires_at_ms) VALUES (?, ?) ON CONFLICT (sandbox_id) DO UPDATE SET expires_at_ms = excluded.expires_at_ms',
    sandboxId,
    DateTime.toEpochMillis(expiresAt),
  );
}

function releaseLease({ sql, sandboxId }: SqlCall<LeaseInput>): void {
  sql.exec('DELETE FROM leases WHERE sandbox_id = ?', sandboxId);
}
