import { ReceiptStatus } from '@mechane/sandbox-wire';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Duration } from 'effect';
import type { Option } from 'effect';
import { ExecutionStatus } from '../constants.ts';
import { ExecutionRow } from '../schemas.ts';
import type {
  ClaimExecutionInput,
  DispatchExecutionInput,
  ExecutionIdInput,
  ExecutionRecords,
  SettleExecutionInput,
} from '../types.ts';
import { failPersistence } from './fail-persistence.ts';

/** The sandbox's executions on its object's SQL storage. */
export function executionRecords({ sql }: RecordsInput): ExecutionRecords {
  const unfinishedExecutions: ExecutionRecords['unfinishedExecutions'] = () => {
    const cursor = sql.exec(
      'SELECT * FROM executions WHERE status IN (?, ?) ORDER BY rowid',
      ExecutionStatus.Pending,
      ExecutionStatus.Dispatched,
    );

    return decodeRows({ cursor, schema: ExecutionRow });
  };

  const cancelPendingExecution: ExecutionRecords['cancelPendingExecution'] = ({ executionId }) => {
    sql.exec('INSERT INTO execution_cancellations (id) VALUES (?) ON CONFLICT (id) DO NOTHING', executionId);
    sql.exec(
      'UPDATE executions SET status = ? WHERE id = ? AND status = ?',
      ExecutionStatus.Unavailable,
      executionId,
      ExecutionStatus.Pending,
    );
  };

  return {
    execution: (input) => execution({ sql, ...input }),
    activeExecution: () => activeExecution({ sql }),
    unfinishedExecutions,
    cancelPendingExecution,
    claimExecution: (input) => claimExecution({ sql, ...input }),
    dispatchExecution: (input) => dispatchExecution({ sql, ...input }),
    settleExecution: (input) => settleExecution({ sql, ...input }),
    failPersistence: (input) => failPersistence({ sql, ...input }),
  };
}

function activeExecution({ sql }: RecordsInput): Option.Option<ExecutionRow> {
  const cursor = sql.exec(
    'SELECT * FROM executions WHERE status = ? ORDER BY rowid LIMIT 1',
    ExecutionStatus.Dispatched,
  );

  return decodeFirst({ cursor, schema: ExecutionRow });
}

function execution({ sql, executionId }: SqlCall<ExecutionIdInput>): Option.Option<ExecutionRow> {
  const cursor = sql.exec('SELECT * FROM executions WHERE id = ?', executionId);

  return decodeFirst({ cursor, schema: ExecutionRow });
}

function claimExecution({ sql, request, now }: SqlCall<ClaimExecutionInput>): void {
  sql.exec(
    'INSERT INTO executions (id, command, timeout_ms, status, claimed_at_ms) VALUES (?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM execution_cancellations WHERE id = ?) THEN ? ELSE ? END, ?)',
    request.executionId,
    request.command,
    Duration.toMillis(request.timeout),
    request.executionId,
    ExecutionStatus.Unavailable,
    ExecutionStatus.Pending,
    DateTime.toEpochMillis(now),
  );
}

function dispatchExecution({ sql, executionId, machineId, now }: SqlCall<DispatchExecutionInput>): void {
  sql.exec(
    'UPDATE executions SET status = ?, machine_id = ?, dispatched_at_ms = ? WHERE id = ? AND status = ?',
    ExecutionStatus.Dispatched,
    machineId,
    DateTime.toEpochMillis(now),
    executionId,
    ExecutionStatus.Pending,
  );
}

/** Stores a receipt once, from the machine the execution was sent to; a receipt a racing call stored first stays. */
function settleExecution({ sql, executionId, machineId, receipt, now }: SqlCall<SettleExecutionInput>): void {
  switch (receipt.state) {
    case ReceiptStatus.Exited:
      sql.exec(
        'UPDATE executions SET status = ?, exit_code = ?, duration_ms = ?, output_text = ?, omitted_bytes = ?, settled_at_ms = ? WHERE id = ? AND machine_id = ? AND status = ?',
        ExecutionStatus.Exited,
        receipt.exitCode,
        Duration.toMillis(receipt.duration),
        receipt.output.text,
        receipt.output.omittedBytes,
        DateTime.toEpochMillis(now),
        executionId,
        machineId,
        ExecutionStatus.Dispatched,
      );

      break;
    case ReceiptStatus.TimedOut:
      sql.exec(
        'UPDATE executions SET status = ?, duration_ms = ?, output_text = ?, omitted_bytes = ?, settled_at_ms = ? WHERE id = ? AND machine_id = ? AND status = ?',
        ExecutionStatus.TimedOut,
        Duration.toMillis(receipt.duration),
        receipt.output.text,
        receipt.output.omittedBytes,
        DateTime.toEpochMillis(now),
        executionId,
        machineId,
        ExecutionStatus.Dispatched,
      );
  }
}
