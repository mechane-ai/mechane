import { DroneStatus } from '@mechane/protocol';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { EndedDroneRow } from '../drone.schemas.ts';
import type { CancelDroneInput, DroneEndRecords, DroneIdInput, DroneStepInput, EndDroneInput } from '../drone.types.ts';
import { CancelRow, IdRow, RefusalRow } from '../schemas.ts';
import type { CursorInput } from '../types.ts';

/**
 * How a mech's drones end: once each, with a report or a reason for none, after any cancel or refusal it records; then
 * their sandbox's machine stops.
 */
export function droneEndRecords({ sql }: RecordsInput): DroneEndRecords {
  return {
    endDrone: (input) => endDrone({ sql, ...input }),
    refuseDrone: (input) => refuseDrone({ sql, ...input }),
    droneRefusal: (input) => droneRefusal({ sql, ...input }),
    cancelDrone: (input) => cancelDrone({ sql, ...input }),
    droneCancel: (input) => droneCancel({ sql, ...input }),
    unstoppedDrones: () => unstoppedDrones({ sql }),
    stopDrone: (input) => stopDrone({ sql, ...input }),
  };
}

function endDrone({ sql, droneId, end, now }: SqlCall<EndDroneInput>): Option.Option<EndedDroneRow> {
  switch (end.status) {
    case DroneStatus.Reported:
      return endedDrone({
        cursor: sql.exec(
          'UPDATE drones SET status = ?, ended_at_ms = ? WHERE id = ? AND status = ? RETURNING thread_id, report_inbox_item_id',
          end.status,
          DateTime.toEpochMillis(now),
          droneId,
          DroneStatus.Running,
        ),
      });
    case DroneStatus.Unreported:
      return endedDrone({
        cursor: sql.exec(
          'UPDATE drones SET status = ?, ended_at_ms = ?, reason = ? WHERE id = ? AND status = ? RETURNING thread_id, report_inbox_item_id',
          end.status,
          DateTime.toEpochMillis(now),
          end.reason,
          droneId,
          DroneStatus.Running,
        ),
      });
  }
}

/** The thread and report item id of the drone an end's statement ended, none when it ended before. */
function endedDrone({ cursor }: CursorInput): Option.Option<EndedDroneRow> {
  return decodeFirst({ cursor, schema: EndedDroneRow });
}

function refuseDrone({ sql, droneId, now }: SqlCall<DroneStepInput>): void {
  sql.exec(
    'UPDATE drones SET refused_at_ms = COALESCE(refused_at_ms, ?) WHERE id = ?',
    DateTime.toEpochMillis(now),
    droneId,
  );
}

function droneRefusal({ sql, droneId }: SqlCall<DroneIdInput>): Option.Option<RefusalRow> {
  const cursor = sql.exec('SELECT refused_at_ms FROM drones WHERE id = ? AND refused_at_ms IS NOT NULL', droneId);

  return decodeFirst({ cursor, schema: RefusalRow });
}

function cancelDrone({ sql, droneId, cancelerId, now }: SqlCall<CancelDroneInput>): void {
  sql.exec(
    'UPDATE drones SET canceled_at_ms = ?, canceler_id = ? WHERE id = ? AND status = ? AND canceled_at_ms IS NULL',
    DateTime.toEpochMillis(now),
    cancelerId,
    droneId,
    DroneStatus.Running,
  );
}

function droneCancel({ sql, droneId }: SqlCall<DroneIdInput>): Option.Option<CancelRow> {
  const cursor = sql.exec(
    'SELECT canceled_at_ms, canceler_id FROM drones WHERE id = ? AND canceled_at_ms IS NOT NULL',
    droneId,
  );

  return decodeFirst({ cursor, schema: CancelRow });
}

/**
 * A drone that never bound a session never sent a command, so its sandbox never started a machine and needs no stop.
 * The partial index holds only bound drones whose machine's stop is not recorded, so the read stays small.
 */
function unstoppedDrones({ sql }: RecordsInput): ReadonlyArray<string> {
  const cursor = sql.exec(
    'SELECT id FROM drones WHERE stopped_at_ms IS NULL AND pi_session_id IS NOT NULL AND status != ? ORDER BY ended_at_ms, rowid',
    DroneStatus.Running,
  );

  return decodeRows({ cursor, schema: IdRow }).map(({ id }) => id);
}

function stopDrone({ sql, droneId, now }: SqlCall<DroneStepInput>): void {
  sql.exec(
    'UPDATE drones SET stopped_at_ms = ? WHERE id = ? AND stopped_at_ms IS NULL',
    DateTime.toEpochMillis(now),
    droneId,
  );
}
