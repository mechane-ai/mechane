import { BoundedRequestRecordId, renamedWireStruct, wireStruct } from '@mechane/records';
import type { TurnId } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { BoundedTurnRow } from './schemas.ts';
import type {
  BoundedNowInput,
  BoundedRequestInput,
  FinishBoundedTurnInput,
  RecordBoundedTurnInput,
  StopBoundedTurnInput,
} from './types.ts';

const DeadlineRow = renamedWireStruct({
  fields: { deadlineAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis) },
  renames: { deadlineAt: 'deadline_at_ms' },
});

const RequestIdRow = wireStruct({ fields: { requestId: BoundedRequestRecordId } });

type BoundedTurnLookup = { readonly turnId: TurnId };

/** Keeps bounded admission and terminal outcomes beside the inbox item that executes them. */
export function boundedTurnRecords({ sql }: RecordsInput) {
  return {
    boundedTurn: (input: BoundedRequestInput): Option.Option<BoundedTurnRow> => boundedTurn({ sql, ...input }),
    boundedTurnForTurn: (input: BoundedTurnLookup): Option.Option<BoundedTurnRow> =>
      boundedTurnForTurn({ sql, ...input }),
    recordBoundedTurn: (input: RecordBoundedTurnInput): void => recordBoundedTurn({ sql, ...input }),
    stopBoundedTurn: (input: StopBoundedTurnInput): void => stopBoundedTurn({ sql, ...input }),
    finishBoundedTurn: (input: FinishBoundedTurnInput): void => finishBoundedTurn({ sql, ...input }),
    expiredBoundedTurns: (input: BoundedNowInput): ReadonlyArray<BoundedTurnRow> =>
      expiredBoundedTurns({ sql, ...input }),
    nextBoundedTurnAt: (): Option.Option<DateTime.Utc> => nextBoundedTurnAt({ sql }),
    boundedTurnCancellations: (): ReadonlyArray<BoundedRequestRecordId> => boundedTurnCancellations({ sql }),
  };
}

function boundedTurn({ sql, requestId }: SqlCall<BoundedRequestInput>): Option.Option<BoundedTurnRow> {
  const cursor = sql.exec(
    'SELECT bounded_turns.*, inbox_items.turn_id, inbox_items.text, inbox_items.sender_id, inbox_items.received_at_ms FROM bounded_turns JOIN inbox_items ON inbox_items.id = bounded_turns.request_id WHERE bounded_turns.request_id = ?',
    requestId,
  );

  return decodeFirst({ cursor, schema: BoundedTurnRow });
}

function boundedTurnForTurn({ sql, turnId }: SqlCall<BoundedTurnLookup>): Option.Option<BoundedTurnRow> {
  const cursor = sql.exec(
    'SELECT bounded_turns.*, inbox_items.turn_id, inbox_items.text, inbox_items.sender_id, inbox_items.received_at_ms FROM bounded_turns JOIN inbox_items ON inbox_items.id = bounded_turns.request_id WHERE inbox_items.turn_id = ?',
    turnId,
  );

  return decodeFirst({ cursor, schema: BoundedTurnRow });
}

function recordBoundedTurn({
  sql,
  requestId,
  maxModelDispatches,
  maxOutputTokens,
  deadlineAt,
}: SqlCall<RecordBoundedTurnInput>): void {
  const deadlineAtMs = DateTime.toEpochMillis(deadlineAt);

  sql.exec(
    'INSERT INTO bounded_turns (request_id, max_model_dispatches, max_output_tokens, deadline_at_ms, dispatched_count) VALUES (?, ?, ?, ?, 0)',
    requestId,
    maxModelDispatches,
    maxOutputTokens,
    deadlineAtMs,
  );
}

function stopBoundedTurn({ sql, requestId, reason, now }: SqlCall<StopBoundedTurnInput>): void {
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'UPDATE bounded_turns SET reason = COALESCE(reason, ?), ended_at_ms = CASE WHEN (SELECT turn_id FROM inbox_items WHERE id = ?) IS NULL THEN ? ELSE ended_at_ms END WHERE request_id = ? AND ended_at_ms IS NULL',
    reason,
    requestId,
    nowMs,
    requestId,
  );
}

function finishBoundedTurn({ sql, requestId, reason, reply, now }: SqlCall<FinishBoundedTurnInput>): void {
  const storedReason = Option.getOrNull(reason);
  const storedReply = Option.getOrNull(reply);
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'UPDATE bounded_turns SET reason = COALESCE(reason, ?), reply = CASE WHEN reason IS NULL THEN ? ELSE NULL END, ended_at_ms = ? WHERE request_id = ? AND ended_at_ms IS NULL',
    storedReason,
    storedReply,
    nowMs,
    requestId,
  );
}

function expiredBoundedTurns({ sql, now }: SqlCall<BoundedNowInput>): ReadonlyArray<BoundedTurnRow> {
  const nowMs = DateTime.toEpochMillis(now);

  const cursor = sql.exec(
    'SELECT bounded_turns.*, inbox_items.turn_id, inbox_items.text, inbox_items.sender_id, inbox_items.received_at_ms FROM bounded_turns JOIN inbox_items ON inbox_items.id = bounded_turns.request_id WHERE bounded_turns.ended_at_ms IS NULL AND bounded_turns.deadline_at_ms <= ?',
    nowMs,
  );

  return decodeRows({ cursor, schema: BoundedTurnRow });
}

function nextBoundedTurnAt({ sql }: RecordsInput): Option.Option<DateTime.Utc> {
  const cursor = sql.exec(
    'SELECT MIN(deadline_at_ms) AS deadline_at_ms FROM bounded_turns WHERE ended_at_ms IS NULL AND reason IS NULL',
  );

  const row = decodeFirst({ cursor, schema: DeadlineRow });

  return Option.flatMap(row, ({ deadlineAt }) => deadlineAt);
}

/** The inbox marker advances only after the alarm aborts the corresponding Pi submission. */
function boundedTurnCancellations({ sql }: RecordsInput): ReadonlyArray<BoundedRequestRecordId> {
  const cursor = sql.exec(
    'SELECT bounded_turns.request_id FROM bounded_turns JOIN inbox_items ON inbox_items.id = bounded_turns.request_id WHERE bounded_turns.reason IS NOT NULL AND inbox_items.written_at_ms IS NULL',
  );

  const rows = decodeRows({ cursor, schema: RequestIdRow });

  return rows.map(({ requestId }) => requestId);
}
