import { TurnStatus } from '@mechane/protocol';
import { decodeFirst, decodeRows, rowCount } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option } from 'effect';
import { RecordedChangeRow, SavedMemoryRow, TurnMemoryRow } from '../memory.schemas.ts';
import type {
  DiscardMemoryChangesInput,
  MemoryRecords,
  PathInput,
  RecordMemoryDeletionInput,
  RecordMemoryWriteInput,
  SavedMemoriesInput,
  SavedMemoryInput,
  SaveMemoryChangesInput,
} from '../memory.types.ts';
import type { TaskIdInput } from '../task.types.ts';

/**
 * A mech's memory, one change per row: a change records the running turn and is pending, with no version or time, until
 * that turn ends. Saved changes are never edited, and only a running turn's tool calls record a change, which that
 * turn's end saves or discards.
 */
export function memoryRecords({ sql }: RecordsInput): MemoryRecords {
  return {
    recordedChange: (input) => recordedChange({ sql, ...input }),
    turnMemory: (input) => turnMemory({ sql, ...input }),
    turnMemoryCount: () => turnMemoryCount({ sql }),
    recordMemoryWrite: (input) => recordMemoryWrite({ sql, ...input }),
    recordMemoryDeletion: (input) => recordMemoryDeletion({ sql, ...input }),
    savedMemories: (input) => savedMemories({ sql, ...input }),
    savedMemory: (input) => savedMemory({ sql, ...input }),
    saveMemoryChanges: (input) => saveMemoryChanges({ sql, ...input }),
    discardMemoryChanges: (input) => discardMemoryChanges({ sql, ...input }),
  };
}

function recordedChange({ sql, taskId }: SqlCall<TaskIdInput>): Option.Option<RecordedChangeRow> {
  const cursor = sql.exec('SELECT digest FROM memory_changes WHERE pi_task_id = ?', taskId);

  return decodeFirst({ cursor, schema: RecordedChangeRow });
}

/**
 * The running turn's newest change of the path, else its newest saved one; a deletion leaves no memory. Each memory
 * query picks its rows by the path index and reads a text only for a row it answers, since saved versions are kept.
 */
function turnMemory({ sql, path }: SqlCall<PathInput>): Option.Option<TurnMemoryRow> {
  const cursor = sql.exec(
    'SELECT text, digest, version FROM memory_changes WHERE text IS NOT NULL AND pi_task_id = (SELECT pi_task_id FROM memory_changes WHERE path = ? ORDER BY version IS NULL DESC, version DESC, pi_task_id DESC LIMIT 1)',
    path,
  );

  return decodeFirst({ cursor, schema: TurnMemoryRow });
}

function turnMemoryCount({ sql }: RecordsInput): number {
  return rowCount({
    cursor: sql.exec(
      'SELECT COUNT(*) AS count FROM memory_changes WHERE text IS NOT NULL AND pi_task_id IN (SELECT pi_task_id FROM (SELECT pi_task_id, ROW_NUMBER() OVER (PARTITION BY path ORDER BY version IS NULL DESC, version DESC, pi_task_id DESC) AS recency FROM memory_changes) WHERE recency = 1)',
    ),
  });
}

function recordMemoryWrite({ sql, taskId, path, text, digest }: SqlCall<RecordMemoryWriteInput>): void {
  sql.exec(
    'INSERT INTO memory_changes (pi_task_id, turn_id, path, text, digest) VALUES (?, (SELECT id FROM turns WHERE status = ?), ?, ?, ?)',
    taskId,
    TurnStatus.Running,
    path,
    text,
    digest,
  );
}

/** A deletion leaves the change's text and digest empty, which no saved memory then reads. */
function recordMemoryDeletion({ sql, taskId, path }: SqlCall<RecordMemoryDeletionInput>): void {
  sql.exec(
    'INSERT INTO memory_changes (pi_task_id, turn_id, path) VALUES (?, (SELECT id FROM turns WHERE status = ?), ?)',
    taskId,
    TurnStatus.Running,
    path,
  );
}

/** No bound reads every saved version, since a version is never above itself. */
function savedMemories({ sql, throughVersion }: SqlCall<SavedMemoriesInput>): ReadonlyArray<SavedMemoryRow> {
  const cursor = sql.exec(
    'SELECT path, text, digest, version, turn_id, saved_at_ms FROM memory_changes WHERE text IS NOT NULL AND version IN (SELECT MAX(version) FROM memory_changes WHERE version <= COALESCE(?, version) GROUP BY path) ORDER BY path',
    Option.getOrNull(throughVersion),
  );

  return decodeRows({ cursor, schema: SavedMemoryRow });
}

function savedMemory({ sql, path, throughVersion }: SqlCall<SavedMemoryInput>): Option.Option<TurnMemoryRow> {
  const cursor = sql.exec(
    'SELECT text, digest, version FROM memory_changes WHERE text IS NOT NULL AND version = (SELECT MAX(version) FROM memory_changes WHERE path = ? AND version <= ?)',
    path,
    throughVersion,
  );

  return decodeFirst({ cursor, schema: TurnMemoryRow });
}

/** Saves the turn's pending changes under the next versions in task order, which is the order its calls ran in. */
function saveMemoryChanges({ sql, turnId, now }: SqlCall<SaveMemoryChangesInput>): void {
  sql.exec(
    'UPDATE memory_changes SET version = numbered.version, saved_at_ms = ? FROM (SELECT pi_task_id, (SELECT COALESCE(MAX(version), 0) FROM memory_changes) + ROW_NUMBER() OVER (ORDER BY pi_task_id) AS version FROM memory_changes WHERE turn_id = ? AND version IS NULL) AS numbered WHERE memory_changes.pi_task_id = numbered.pi_task_id',
    DateTime.toEpochMillis(now),
    turnId,
  );
}

function discardMemoryChanges({ sql, turnId }: SqlCall<DiscardMemoryChangesInput>): void {
  sql.exec('DELETE FROM memory_changes WHERE turn_id = ? AND version IS NULL', turnId);
}
