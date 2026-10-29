import { DroneStatus, ThreadState } from '@mechane/protocol';
import { decodeFirst, decodeRows, readPage, rowCount } from '@mechane/store';
import type { PageAfterInput, RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option } from 'effect';
import type { TaskIdInput } from '../task.types.ts';
import { OpenThreadRow, ThreadRow, ThreadRowPage } from '../thread.schemas.ts';
import type { OpenThreadInput, ThreadIdInput, ThreadRecords, UpdateThreadInput } from '../thread.types.ts';

/** A mech's threads, each opened by one open_thread task, which its mech's tools alone change. */
export function threadRecords({ sql }: RecordsInput): ThreadRecords {
  return {
    openedThread: (input) => openedThread({ sql, ...input }),
    openThreadCount: () => openThreadCount({ sql }),
    openThread: (input) => openThread({ sql, ...input }),
    thread: (input) => thread({ sql, ...input }),
    updateThread: (input) => updateThread({ sql, ...input }),
    threads: (input) => threads({ sql, ...input }),
    openThreads: () => openThreads({ sql }),
  };
}

function openedThread({ sql, taskId }: SqlCall<TaskIdInput>): Option.Option<ThreadRow> {
  const cursor = sql.exec(
    'SELECT id, title, state, note, opened_at_ms, updated_at_ms FROM threads WHERE pi_task_id = ?',
    taskId,
  );

  return decodeFirst({ cursor, schema: ThreadRow });
}

function openThreadCount({ sql }: RecordsInput): number {
  return rowCount({ cursor: sql.exec('SELECT COUNT(*) AS count FROM threads WHERE state != ?', ThreadState.Resolved) });
}

function openThread({ sql, threadId, taskId, title, now }: SqlCall<OpenThreadInput>): void {
  sql.exec(
    'INSERT INTO threads (id, pi_task_id, title, state, opened_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?)',
    threadId,
    taskId,
    title,
    ThreadState.Working,
    DateTime.toEpochMillis(now),
    DateTime.toEpochMillis(now),
  );
}

function thread({ sql, threadId }: SqlCall<ThreadIdInput>): Option.Option<ThreadRow> {
  const cursor = sql.exec(
    'SELECT id, title, state, note, opened_at_ms, updated_at_ms FROM threads WHERE id = ?',
    threadId,
  );

  return decodeFirst({ cursor, schema: ThreadRow });
}

function updateThread({ sql, threadId, state, note, now }: SqlCall<UpdateThreadInput>): void {
  sql.exec(
    'UPDATE threads SET state = ?, note = COALESCE(?, note), updated_at_ms = ? WHERE id = ?',
    state,
    Option.getOrNull(note),
    DateTime.toEpochMillis(now),
    threadId,
  );
}

function threads({ sql, after }: SqlCall<PageAfterInput>): ThreadRowPage {
  const page = readPage({
    after,
    lastRow: ({ last }) => sql.exec('SELECT rowid FROM threads WHERE id = ?', last),
    rowsAfter: ({ rowid, count }) =>
      sql.exec(
        'SELECT id, title, state, note, opened_at_ms, updated_at_ms FROM threads WHERE rowid > ? ORDER BY rowid LIMIT ?',
        rowid,
        count,
      ),
    schema: ThreadRow,
  });

  return Option.match(page, {
    onNone: () => ThreadRowPage.cases.CursorMissing.make({}),
    onSome: ({ rows, hasMore }) => ThreadRowPage.cases.Listed.make({ threads: rows, hasMore }),
  });
}

function openThreads({ sql }: RecordsInput): ReadonlyArray<OpenThreadRow> {
  const cursor = sql.exec(
    'SELECT threads.id, threads.title, threads.state, threads.note, (SELECT COUNT(*) FROM drones WHERE drones.status = ? AND drones.thread_id = threads.id) AS running_drones FROM threads WHERE threads.state != ? ORDER BY threads.opened_at_ms, threads.rowid',
    DroneStatus.Running,
    ThreadState.Resolved,
  );

  return decodeRows({ cursor, schema: OpenThreadRow });
}
