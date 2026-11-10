import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Option, Result, Schema } from 'effect';
import { BackgroundWork } from '../completions/completion-records.ts';
import { FileCheckpointPurpose, FileCheckpointResult } from './schemas.ts';

type CheckpointOperationInput = { readonly purpose: Pick<FileCheckpointPurpose, '_tag' | 'operationId'> };
type ClaimCheckpointInput = { readonly purpose: FileCheckpointPurpose; readonly now: DateTime.Utc };
type FinishCheckpointInput = CheckpointOperationInput & { readonly result: FileCheckpointResult };
type RecoveryCheckpointInput = Pick<FileCheckpointPurpose, 'operationId'>;
type ReadOperationInput = { readonly key: string };

const ResultJson = Schema.fromJsonString(FileCheckpointResult);
const PurposeJson = Schema.fromJsonString(FileCheckpointPurpose);
const RecoveryPurposeJson = Schema.fromJsonString(FileCheckpointPurpose.cases.Recovery);
const RecoveryPurposeRow = Schema.Struct({ purpose: RecoveryPurposeJson });

const ResultRow = Schema.Struct({
  startedAt: Schema.DateTimeUtcFromMillis,
  result: ResultJson,
  /** Older operations did not need caller-observed recovery fences. */
  purpose: Schema.OptionFromNullOr(PurposeJson),
});

const PRESENT_ROW_VALUE = 1;
const PresentRow = Schema.Struct({ present: Schema.Literal(PRESENT_ROW_VALUE) });

const OPERATION_PREFIX = {
  Maintenance: 'maintenance',
  Drain: 'drain',
  Activation: 'activation',
  Recovery: 'recovery',
} as const;

export class FileCheckpointIdentityReused extends Schema.TaggedError<FileCheckpointIdentityReused>()(
  'FileCheckpointIdentityReused',
  { purpose: FileCheckpointPurpose },
) {}

class FileCheckpointMissing extends Schema.TaggedError<FileCheckpointMissing>()('FileCheckpointMissing', {
  purpose: FileCheckpointPurpose,
}) {}

/** File operations retain their own receipts; command execution history contains only actual commands. */
export function fileCheckpointRecords({ sql }: RecordsInput) {
  function readFileCheckpoint({ purpose }: CheckpointOperationInput): Option.Option<typeof ResultRow.Type> {
    const key = operationKey({ purpose });

    return readOperation({ key });
  }

  function readOperation({ key }: ReadOperationInput): Option.Option<typeof ResultRow.Type> {
    const cursor = sql.exec(
      'SELECT started_at_ms AS startedAt, result, purpose FROM file_checkpoint_results WHERE operation_id = ?',
      key,
    );

    return decodeFirst({ cursor, schema: ResultRow });
  }

  function fileCheckpointResult({ purpose }: CheckpointOperationInput): Option.Option<FileCheckpointResult> {
    const checkpoint = readFileCheckpoint({ purpose });

    return Option.map(checkpoint, ({ result }) => result);
  }

  function recoveryCheckpointResult({ operationId }: RecoveryCheckpointInput): Option.Option<FileCheckpointResult> {
    const key = `${OPERATION_PREFIX.Recovery}-${operationId}`;
    const checkpoint = readOperation({ key });

    return Option.map(checkpoint, ({ result }) => result);
  }

  function pendingRecoveryCheckpoint(): Option.Option<typeof RecoveryPurposeJson.Type> {
    const cursor = sql.exec(
      "SELECT purpose FROM file_checkpoint_results WHERE json_extract(purpose, '$._tag') = 'Recovery' AND json_extract(result, '$._tag') = 'Pending' ORDER BY rowid LIMIT 1",
    );

    const checkpoint = decodeFirst({ cursor, schema: RecoveryPurposeRow });

    return Option.map(checkpoint, ({ purpose }) => purpose);
  }

  function claimFileCheckpoint({ purpose, now }: ClaimCheckpointInput): typeof ResultRow.Type {
    const key = operationKey({ purpose });
    const pending = FileCheckpointResult.cases.Pending.make({});
    const value = Schema.encodeSync(ResultJson)(pending);
    const startedAt = DateTime.toEpochMillis(now);
    const encodedPurpose = Schema.encodeSync(PurposeJson)(purpose);

    sql.exec(
      'INSERT INTO file_checkpoint_results (operation_id, started_at_ms, result, purpose) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
      key,
      startedAt,
      value,
      encodedPurpose,
    );

    const checkpoint = readFileCheckpoint({ purpose });

    if (Option.isNone(checkpoint)) {
      const cause = new FileCheckpointMissing({ purpose });
      const failure = Result.fail(cause);

      return Result.getOrThrow(failure);
    }

    const previous = checkpoint.value.purpose;
    const isMissingRecoveryPurpose = FileCheckpointPurpose.guards.Recovery(purpose) && Option.isNone(previous);
    const isDifferent = Option.exists(previous, (stored) => Schema.encodeSync(PurposeJson)(stored) !== encodedPurpose);

    if (isMissingRecoveryPurpose || isDifferent) {
      const cause = new FileCheckpointIdentityReused({ purpose });
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

  function fileCheckpointWork(): BackgroundWork {
    const cursor = sql.exec(
      "SELECT 1 AS present WHERE EXISTS (SELECT 1 FROM executions WHERE status IN ('pending', 'dispatched')) OR EXISTS (SELECT 1 FROM managed_processes WHERE json_extract(record, '$.observation.state._tag') IS NULL OR json_extract(record, '$.observation.state._tag') = 'Running') OR EXISTS (SELECT 1 FROM browser_calls WHERE json_extract(record, '$.response') IS NULL AND json_extract(record, '$.failure') IS NULL)",
    );

    const present = decodeFirst({ cursor, schema: PresentRow });

    if (Option.isSome(present)) {
      return BackgroundWork.cases.Active.make({});
    }

    return BackgroundWork.cases.Idle.make({});
  }

  return {
    fileCheckpointResult,
    recoveryCheckpointResult,
    pendingRecoveryCheckpoint,
    claimFileCheckpoint,
    finishFileCheckpoint,
    fileCheckpointWork,
  };
}

function operationKey({ purpose }: CheckpointOperationInput): string {
  const prefix = OPERATION_PREFIX[purpose._tag];

  return `${prefix}-${purpose.operationId}`;
}
