import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Schema } from 'effect';
import { FileCheckpointResult } from './schemas.ts';
import type { FileCheckpointPurpose } from './schemas.ts';

type CheckpointOperationInput = { readonly purpose: FileCheckpointPurpose };
type ClaimCheckpointInput = CheckpointOperationInput & { readonly now: DateTime.Utc };
type FinishCheckpointInput = CheckpointOperationInput & { readonly result: FileCheckpointResult };

const ResultJson = Schema.fromJsonString(FileCheckpointResult);
const ResultRow = Schema.Struct({ startedAt: Schema.DateTimeUtcFromMillis, result: ResultJson });

/** File operations retain their own receipts; command execution history contains only actual commands. */
export function fileCheckpointRecords({ sql }: RecordsInput) {
  function claimFileCheckpoint({ purpose, now }: ClaimCheckpointInput): typeof ResultRow.Type {
    const key = operationKey({ purpose });
    const pending = FileCheckpointResult.cases.Pending.make({});
    const value = Schema.encodeSync(ResultJson)(pending);
    const startedAt = DateTime.toEpochMillis(now);

    sql.exec(
      'INSERT INTO file_checkpoint_results (operation_id, started_at_ms, result) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      key,
      startedAt,
      value,
    );

    const cursor = sql.exec(
      'SELECT started_at_ms AS startedAt, result FROM file_checkpoint_results WHERE operation_id = ?',
      key,
    );

    return decodeOne({ cursor, schema: ResultRow });
  }

  function finishFileCheckpoint({ purpose, result }: FinishCheckpointInput): void {
    const key = operationKey({ purpose });
    const value = Schema.encodeSync(ResultJson)(result);
    const pending = FileCheckpointResult.cases.Pending.make({});

    sql.exec(
      "UPDATE file_checkpoint_results SET result = ? WHERE operation_id = ? AND json_extract(result, '$._tag') = ?",
      value,
      key,
      pending._tag,
    );
  }

  return { claimFileCheckpoint, finishFileCheckpoint };
}

function operationKey({ purpose }: CheckpointOperationInput): string {
  return `maintenance-${purpose.operationId}`;
}
