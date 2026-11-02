import { decodeFirst, rowCount } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { LeaseRow } from '../schemas.ts';
import type { HoldLeaseInput, LeaseInput, MachineLeaseRecords, NowInput } from '../types.ts';

/** One fenced reservation per sandbox, released only by its matching stop. */
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
  sql.exec('DELETE FROM leases WHERE reservation_id IS NULL AND expires_at_ms <= ?', DateTime.toEpochMillis(now));
}

function sandboxLease({ sql, sandboxId }: SqlCall<LeaseInput>): Option.Option<LeaseRow> {
  const cursor = sql.exec('SELECT expires_at_ms, reservation_id, active FROM leases WHERE sandbox_id = ?', sandboxId);

  return decodeFirst({ cursor, schema: LeaseRow });
}

function leaseCount({ sql }: RecordsInput): number {
  return rowCount({ cursor: sql.exec('SELECT COUNT(*) AS count FROM leases WHERE active = 1') });
}

function holdLease({ sql, sandboxId, reservationId, now }: SqlCall<HoldLeaseInput>): void {
  sql.exec(
    'INSERT INTO leases (sandbox_id, expires_at_ms, reservation_id, active) VALUES (?, ?, ?, 1) ON CONFLICT (sandbox_id) DO UPDATE SET reservation_id = excluded.reservation_id, expires_at_ms = excluded.expires_at_ms, active = 1 WHERE leases.reservation_id IS NULL OR leases.reservation_id < excluded.reservation_id OR (leases.reservation_id = excluded.reservation_id AND leases.active = 1)',
    sandboxId,
    DateTime.toEpochMillis(now),
    reservationId,
  );
}

function releaseLease({ sql, sandboxId, reservationId }: SqlCall<Omit<HoldLeaseInput, 'now'>>): void {
  // A release can arrive before an uncertain acquire. Retain its sequence so that acquire cannot resurrect capacity.
  sql.exec(
    'INSERT INTO leases (sandbox_id, expires_at_ms, reservation_id, active) VALUES (?, 0, ?, 0) ON CONFLICT (sandbox_id) DO UPDATE SET reservation_id = excluded.reservation_id, active = 0 WHERE leases.reservation_id IS NULL OR leases.reservation_id <= excluded.reservation_id',
    sandboxId,
    reservationId,
  );
}
