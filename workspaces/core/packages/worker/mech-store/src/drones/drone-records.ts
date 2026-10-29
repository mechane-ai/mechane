import { DroneStatus } from '@mechane/protocol';
import { decodeFirst, decodeOne, decodeRows, readPage, rowCount } from '@mechane/store';
import type { PageAfterInput, RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { DroneRow, DroneRowPage, RunningDroneRow, SessionDroneRow, StartedDroneRow } from '../drone.schemas.ts';
import type { BindDroneInput, DroneIdInput, DroneRecords, SessionIdInput, StartDroneInput } from '../drone.types.ts';
import type { TaskIdInput } from '../task.types.ts';

/** What a mech told one of its drones to do. */
const BriefRow = Schema.Struct({ brief: Schema.String });

type BriefRow = typeof BriefRow.Type;

/**
 * A mech's drones, each started by one start_drone task, which bind their conversation's session id once, before their
 * first model request.
 */
export function droneRecords({ sql }: RecordsInput): DroneRecords {
  return {
    startedDrone: (input) => startedDrone({ sql, ...input }),
    runningDroneCount: () => runningDroneCount({ sql }),
    startDrone: (input) => startDrone({ sql, ...input }),
    drone: (input) => drone({ sql, ...input }),
    droneBrief: (input) => droneBrief({ sql, ...input }),
    drones: (input) => drones({ sql, ...input }),
    runningDrones: () => runningDrones({ sql }),
    bindDrone: (input) => bindDrone({ sql, ...input }),
    sessionDrone: (input) => sessionDrone({ sql, ...input }),
  };
}

function startedDrone({ sql, taskId }: SqlCall<TaskIdInput>): Option.Option<StartedDroneRow> {
  const cursor = sql.exec('SELECT id, thread_id FROM drones WHERE pi_task_id = ?', taskId);

  return decodeFirst({ cursor, schema: StartedDroneRow });
}

function runningDroneCount({ sql }: RecordsInput): number {
  return rowCount({ cursor: sql.exec('SELECT COUNT(*) AS count FROM drones WHERE status = ?', DroneStatus.Running) });
}

/** The drone reads the newest memory version saved by now, 0 while the mech has saved none. */
function startDrone({ sql, droneId, threadId, taskId, brief, reportInboxItemId, now }: SqlCall<StartDroneInput>): void {
  sql.exec(
    'INSERT INTO drones (id, thread_id, pi_task_id, brief, memory_version, report_inbox_item_id, status, started_at_ms) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(version), 0) FROM memory_changes), ?, ?, ?)',
    droneId,
    threadId,
    taskId,
    brief,
    reportInboxItemId,
    DroneStatus.Running,
    DateTime.toEpochMillis(now),
  );
}

function drone({ sql, droneId }: SqlCall<DroneIdInput>): Option.Option<DroneRow> {
  const cursor = sql.exec(
    'SELECT id, thread_id, status, reason, started_at_ms, ended_at_ms, canceler_id FROM drones WHERE id = ?',
    droneId,
  );

  return decodeFirst({ cursor, schema: DroneRow });
}

/** Only a drone the mech holds has a brief to read. */
function droneBrief({ sql, droneId }: SqlCall<DroneIdInput>): string {
  const cursor = sql.exec('SELECT brief FROM drones WHERE id = ?', droneId);

  return decodeOne({ cursor, schema: BriefRow }).brief;
}

function drones({ sql, after }: SqlCall<PageAfterInput>): DroneRowPage {
  const page = readPage({
    after,
    lastRow: ({ last }) => sql.exec('SELECT rowid FROM drones WHERE id = ?', last),
    rowsAfter: ({ rowid, count }) =>
      sql.exec(
        'SELECT id, thread_id, status, reason, started_at_ms, ended_at_ms, canceler_id FROM drones WHERE rowid > ? ORDER BY rowid LIMIT ?',
        rowid,
        count,
      ),
    schema: DroneRow,
  });

  return Option.match(page, {
    onNone: () => DroneRowPage.cases.CursorMissing.make({}),
    onSome: ({ rows, hasMore }) => DroneRowPage.cases.Listed.make({ drones: rows, hasMore }),
  });
}

function runningDrones({ sql }: RecordsInput): ReadonlyArray<RunningDroneRow> {
  const cursor = sql.exec(
    'SELECT id, brief, canceled_at_ms FROM drones WHERE status = ? ORDER BY started_at_ms, rowid',
    DroneStatus.Running,
  );

  return decodeRows({ cursor, schema: RunningDroneRow });
}

function bindDrone({ sql, droneId, sessionId }: SqlCall<BindDroneInput>): void {
  sql.exec('UPDATE drones SET pi_session_id = ? WHERE id = ? AND pi_session_id IS NULL', sessionId, droneId);
}

/** A drone binds its session id before its conversation's first request, so a session no drone binds is a defect. */
function sessionDrone({ sql, sessionId }: SqlCall<SessionIdInput>): SessionDroneRow {
  const cursor = sql.exec('SELECT id, memory_version FROM drones WHERE pi_session_id = ?', sessionId);

  return decodeOne({ cursor, schema: SessionDroneRow });
}
