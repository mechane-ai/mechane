import type { SqlCall } from '@mechane/store';
import { DateTime, Duration } from 'effect';
import { ExecutionStatus } from '../constants.ts';
import type { PersistenceFailureInput } from '../types.ts';

/** Records a finished command whose live files could not be saved without changing prior terminal results. */
export function failPersistence({
  sql,
  executionId,
  machineId,
  receipt,
  reason,
  now,
}: SqlCall<PersistenceFailureInput>): void {
  const durationMillis = Duration.toMillis(receipt.duration);
  const settledAtMillis = DateTime.toEpochMillis(now);

  sql.exec(
    'UPDATE executions SET status = ?, duration_ms = ?, output_text = ?, omitted_bytes = ?, settled_at_ms = ?, persistence_failure = ? WHERE id = ? AND machine_id = ? AND status = ?',
    ExecutionStatus.PersistenceFailed,
    durationMillis,
    receipt.output.text,
    receipt.output.omittedBytes,
    settledAtMillis,
    reason,
    executionId,
    machineId,
    ExecutionStatus.Dispatched,
  );
}
