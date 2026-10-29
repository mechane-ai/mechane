import { TurnStatus } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { IdRow, TurnRow } from '../schemas.ts';
import type { JoinTurnInput, OpenTurnInput, TurnIdInput, TurnRecords } from '../turn.types.ts';

/** The id of a turn, as its row holds it. */
const TurnIdRow = Schema.Struct({ id: TurnId });

type TurnIdRow = typeof TurnIdRow.Type;

/** The record functions of a mech's turns, each of which takes up the inbox items pi placed in it. */
export function turnRecords({ sql }: RecordsInput): TurnRecords {
  return {
    openTurn: (input) => openTurn({ sql, ...input }),
    runningTurn: () => runningTurn({ sql }),
    joinTurn: (input) => joinTurn({ sql, ...input }),
    turn: (input) => turn({ sql, ...input }),
    turnInboxItemIds: (input) => turnInboxItemIds({ sql, ...input }),
  };
}

function openTurn({ sql, turnId, inboxItemIds, now }: SqlCall<OpenTurnInput>): void {
  sql.exec(
    'INSERT INTO turns (id, status, started_at_ms, definition_revision) SELECT ?, ?, ?, active_revision FROM mech',
    turnId,
    TurnStatus.Running,
    DateTime.toEpochMillis(now),
  );

  for (const inboxItemId of inboxItemIds) {
    joinTurn({ sql, turnId, inboxItemId });
  }
}

/** The schema holds at most one running turn, since a mech runs one turn at a time. */
function runningTurn({ sql }: RecordsInput): Option.Option<TurnId> {
  const cursor = sql.exec('SELECT id FROM turns WHERE status = ?', TurnStatus.Running);
  const running = decodeFirst({ cursor, schema: TurnIdRow });

  return Option.map(running, ({ id }) => id);
}

function joinTurn({ sql, turnId, inboxItemId }: SqlCall<JoinTurnInput>): void {
  sql.exec('UPDATE inbox_items SET turn_id = ? WHERE id = ?', turnId, inboxItemId);
}

function turn({ sql, turnId }: SqlCall<TurnIdInput>): Option.Option<TurnRow> {
  const cursor = sql.exec(
    'SELECT id, status, started_at_ms, ended_at_ms, reason, definition_revision FROM turns WHERE id = ?',
    turnId,
  );

  return decodeFirst({ cursor, schema: TurnRow });
}

function turnInboxItemIds({ sql, turnId }: SqlCall<TurnIdInput>): ReadonlyArray<string> {
  const cursor = sql.exec('SELECT id FROM inbox_items WHERE turn_id = ? ORDER BY received_at_ms', turnId);

  return decodeRows({ cursor, schema: IdRow }).map(({ id }) => id);
}
