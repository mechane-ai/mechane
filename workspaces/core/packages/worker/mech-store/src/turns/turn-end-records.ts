import { TurnStatus, UnansweredReason } from '@mechane/protocol';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option } from 'effect';
import { CancelRow, IdRow, OwedNoteRow, RefusalRow } from '../schemas.ts';
import type { CancelTurnInput, EndTurnInput, TurnEndRecords, TurnIdInput, TurnStepInput } from '../turn.types.ts';
import type { CursorInput } from '../types.ts';

/** The record functions of how a mech's turns end: each once, after the cancel or the refusal it records. */
export function turnEndRecords({ sql }: RecordsInput): TurnEndRecords {
  return {
    endTurn: (input) => endTurn({ sql, ...input }),
    refuseTurn: (input) => refuseTurn({ sql, ...input }),
    turnRefusal: (input) => turnRefusal({ sql, ...input }),
    cancelTurn: (input) => cancelTurn({ sql, ...input }),
    turnCancel: (input) => turnCancel({ sql, ...input }),
    owedNotes: () => owedNotes({ sql }),
    noteTurn: (input) => noteTurn({ sql, ...input }),
  };
}

function endTurn({ sql, turnId, end, now }: SqlCall<EndTurnInput>): Option.Option<string> {
  switch (end.status) {
    case TurnStatus.Answered:
      return endedTurn({
        cursor: sql.exec(
          'UPDATE turns SET status = ?, ended_at_ms = ? WHERE id = ? AND status = ? RETURNING id',
          end.status,
          DateTime.toEpochMillis(now),
          turnId,
          TurnStatus.Running,
        ),
      });
    case TurnStatus.Unanswered:
      return endedTurn({
        cursor: sql.exec(
          'UPDATE turns SET status = ?, ended_at_ms = ?, reason = ? WHERE id = ? AND status = ? RETURNING id',
          end.status,
          DateTime.toEpochMillis(now),
          end.reason,
          turnId,
          TurnStatus.Running,
        ),
      });
  }
}

/** The id of the turn an end's statement ended, none when it ended before. */
function endedTurn({ cursor }: CursorInput): Option.Option<string> {
  return Option.map(decodeFirst({ cursor, schema: IdRow }), ({ id }) => id);
}

function refuseTurn({ sql, turnId, now }: SqlCall<TurnStepInput>): void {
  sql.exec(
    'UPDATE turns SET refused_at_ms = COALESCE(refused_at_ms, ?) WHERE id = ?',
    DateTime.toEpochMillis(now),
    turnId,
  );
}

function turnRefusal({ sql, turnId }: SqlCall<TurnIdInput>): Option.Option<RefusalRow> {
  const cursor = sql.exec('SELECT refused_at_ms FROM turns WHERE id = ? AND refused_at_ms IS NOT NULL', turnId);

  return decodeFirst({ cursor, schema: RefusalRow });
}

function cancelTurn({ sql, turnId, cancelerId, now }: SqlCall<CancelTurnInput>): Option.Option<CancelRow> {
  const cursor = sql.exec(
    'UPDATE turns SET canceled_at_ms = ?, canceler_id = ? WHERE id = ? AND status = ? AND canceled_at_ms IS NULL RETURNING canceled_at_ms, canceler_id',
    DateTime.toEpochMillis(now),
    cancelerId,
    turnId,
    TurnStatus.Running,
  );

  return decodeFirst({ cursor, schema: CancelRow });
}

function turnCancel({ sql, turnId }: SqlCall<TurnIdInput>): Option.Option<CancelRow> {
  const cursor = sql.exec(
    'SELECT canceled_at_ms, canceler_id FROM turns WHERE id = ? AND canceled_at_ms IS NOT NULL',
    turnId,
  );

  return decodeFirst({ cursor, schema: CancelRow });
}

/**
 * The turns whose note is unwritten, oldest first: each canceled turn, running or ended, and each faulted one. A
 * canceled turn has no reason until it ends, and its note is owed from its cancel, a faulted turn's from its end.
 */
function owedNotes({ sql }: RecordsInput): ReadonlyArray<OwedNoteRow> {
  const cursor = sql.exec(
    'SELECT id, COALESCE(reason, ?) AS reason, COALESCE(canceled_at_ms, ended_at_ms) AS owed_at_ms FROM turns WHERE noted_at_ms IS NULL AND (canceled_at_ms IS NOT NULL OR reason = ?) ORDER BY started_at_ms',
    UnansweredReason.Canceled,
    UnansweredReason.Faulted,
  );

  return decodeRows({ cursor, schema: OwedNoteRow });
}

function noteTurn({ sql, turnId, now }: SqlCall<TurnStepInput>): void {
  sql.exec(
    'UPDATE turns SET noted_at_ms = ? WHERE id = ? AND noted_at_ms IS NULL',
    DateTime.toEpochMillis(now),
    turnId,
  );
}
