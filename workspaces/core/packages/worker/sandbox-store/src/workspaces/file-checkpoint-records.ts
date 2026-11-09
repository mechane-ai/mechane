import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Match, Option, Result, Schema } from 'effect';
import { FileCheckpointPurpose, FileCheckpointResult } from './schemas.ts';

type CheckpointOperationInput = { readonly purpose: FileCheckpointPurpose };
type ClaimCheckpointInput = CheckpointOperationInput & { readonly now: DateTime.Utc };
type FinishCheckpointInput = CheckpointOperationInput & { readonly result: FileCheckpointResult };

const ResultJson = Schema.fromJsonString(FileCheckpointResult);
const ResultRow = Schema.Struct({ startedAt: Schema.DateTimeUtcFromMillis, result: ResultJson });

class FileCheckpointMissing extends Schema.TaggedError<FileCheckpointMissing>()('FileCheckpointMissing', {
  purpose: FileCheckpointPurpose,
}) {}

/** File operations retain their own receipts; command execution history contains only actual commands. */
export function fileCheckpointRecords({ sql }: RecordsInput) {
  function readFileCheckpoint({ purpose }: CheckpointOperationInput): Option.Option<typeof ResultRow.Type> {
    const key = operationKey({ purpose });

    const cursor = sql.exec(
      'SELECT started_at_ms AS startedAt, result FROM file_checkpoint_results WHERE operation_id = ?',
      key,
    );

    return decodeFirst({ cursor, schema: ResultRow });
  }

  function fileCheckpointResult({ purpose }: CheckpointOperationInput): Option.Option<FileCheckpointResult> {
    const checkpoint = readFileCheckpoint({ purpose });

    return Option.map(checkpoint, ({ result }) => result);
  }

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

    const checkpoint = readFileCheckpoint({ purpose });

    if (Option.isNone(checkpoint)) {
      const cause = new FileCheckpointMissing({ purpose });
      const failure = Result.fail(cause);

      return Result.getOrThrow(failure);
    }

    return checkpoint.value;
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

  return { fileCheckpointResult, claimFileCheckpoint, finishFileCheckpoint };
}

function operationKey({ purpose }: CheckpointOperationInput): string {
  return Match.valueTags(purpose, {
    Maintenance: ({ operationId }) => `maintenance-${operationId}`,
    Drain: ({ operationId }) => `drain-${operationId}`,
    Activation: ({ operationId }) => `activation-${operationId}`,
  });
}
