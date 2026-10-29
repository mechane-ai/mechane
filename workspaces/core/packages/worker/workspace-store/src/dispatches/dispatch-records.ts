import { DispatchRow, DispatchStatus, SettlementBasis } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import type { WorkDispatchesInput } from '@mechane/records';
import { decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Schema } from 'effect';
import { CommittedRow } from '../schemas.ts';
import type {
  CommittedInput,
  DayInput,
  DispatchRecords,
  RecordDispatchInput,
  SettleDispatchInput,
  SettleOpenDispatchesInput,
} from '../types.ts';

/** The micro-dollars a UTC day has committed in the whole workspace. */
const DayCommittedRow = wireStruct({ fields: { committedMicros: Schema.Int } });

type DayCommittedRow = typeof DayCommittedRow.Type;

/** The ledger of the workspace's dispatches: each decision and settlement, and what each UTC day commits. */
export function dispatchRecords({ sql }: RecordsInput): DispatchRecords {
  return {
    committedMicros: (input) => committedMicros({ sql, ...input }),
    dayCommittedMicros: (input) => dayCommittedMicros({ sql, ...input }),
    recordDispatch: (input) => recordDispatch({ sql, ...input }),
    settleDispatch: (input) => settleDispatch({ sql, ...input }),
    settleOpenDispatches: (input) => settleOpenDispatches({ sql, ...input }),
    workDispatches: (input) => workDispatches({ sql, ...input }),
  };
}

/** The day's committed micro-dollars, settled and reserved, in all and of one mech, read together in one statement. */
function committedMicros({ sql, day, mechId }: SqlCall<CommittedInput>): CommittedRow {
  const cursor = sql.exec(
    'SELECT COALESCE(SUM(committed_micros), 0) AS workspace_micros, COALESCE(SUM(CASE WHEN mech_id = ? THEN committed_micros ELSE 0 END), 0) AS mech_micros FROM dispatches WHERE day = ?',
    mechId,
    day,
  );

  return decodeOne({ cursor, schema: CommittedRow });
}

/** The day's committed micro-dollars of the whole workspace, settled and reserved. */
function dayCommittedMicros({ sql, day }: SqlCall<DayInput>): number {
  const cursor = sql.exec(
    'SELECT COALESCE(SUM(committed_micros), 0) AS committed_micros FROM dispatches WHERE day = ?',
    day,
  );

  return decodeOne({ cursor, schema: DayCommittedRow }).committedMicros;
}

function recordDispatch({ sql, dispatch }: SqlCall<RecordDispatchInput>): void {
  sql.exec(
    'INSERT INTO dispatches (id, mech_id, work_id, model, day, requested_micros, status, decided_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    dispatch.id,
    dispatch.mechId,
    dispatch.workId,
    dispatch.model,
    dispatch.day,
    dispatch.requestedMicros,
    dispatch.status,
    DateTime.toEpochMillis(dispatch.decidedAt),
  );
}

function settleDispatch({ sql, dispatchId, settlement, now }: SqlCall<SettleDispatchInput>): void {
  switch (settlement.basis) {
    case SettlementBasis.Usage:
      sql.exec(
        'UPDATE dispatches SET status = ?, settled_micros = ?, basis = ?, input_tokens = ?, output_tokens = ?, cache_read_tokens = ?, cache_write_tokens = ?, settled_at_ms = ? WHERE id = ? AND status = ?',
        DispatchStatus.Settled,
        settlement.settledMicros,
        settlement.basis,
        settlement.usage.inputTokens,
        settlement.usage.outputTokens,
        settlement.usage.cacheReadTokens,
        settlement.usage.cacheWriteTokens,
        DateTime.toEpochMillis(now),
        dispatchId,
        DispatchStatus.Reserved,
      );

      break;
    case SettlementBasis.Reservation:
      sql.exec(
        'UPDATE dispatches SET status = ?, settled_micros = ?, basis = ?, settled_at_ms = ? WHERE id = ? AND status = ?',
        DispatchStatus.Settled,
        settlement.settledMicros,
        settlement.basis,
        DateTime.toEpochMillis(now),
        dispatchId,
        DispatchStatus.Reserved,
      );
  }
}

function settleOpenDispatches({ sql, mechId, now }: SqlCall<SettleOpenDispatchesInput>): void {
  sql.exec(
    'UPDATE dispatches SET status = ?, settled_micros = requested_micros, basis = ?, settled_at_ms = ? WHERE mech_id = ? AND status = ?',
    DispatchStatus.Settled,
    SettlementBasis.Reservation,
    DateTime.toEpochMillis(now),
    mechId,
    DispatchStatus.Reserved,
  );
}

function workDispatches({ sql, mechId, workId }: SqlCall<WorkDispatchesInput>): ReadonlyArray<DispatchRow> {
  const cursor = sql.exec(
    'SELECT id, model, status, requested_micros, decided_at_ms, settled_micros, settled_at_ms, basis, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens FROM dispatches WHERE mech_id = ? AND work_id = ? ORDER BY decided_at_ms, rowid',
    mechId,
    workId,
  );

  return decodeRows({ cursor, schema: DispatchRow });
}
