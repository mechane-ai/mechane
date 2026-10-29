import { TurnStatus } from '@mechane/protocol';
import { TurnId, wireStruct } from '@mechane/records';
import { decodeFirst, decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { IdRow, InboxItemRow, PendingItemRow } from '../schemas.ts';
import type { InboxItemIdInput, InboxItemRecords, ReceiveInboxItemInput, WriteInboxItemInput } from '../types.ts';

/** The turn an inbox item entered. */
const ItemTurnRow = wireStruct({
  fields: {
    /** Absent while the item waits for a turn. */
    turnId: Schema.OptionFromNullOr(TurnId),
  },
});

type ItemTurnRow = typeof ItemTurnRow.Type;

/** The record functions of a mech's inbox items, each received once under the id its sender made. */
export function inboxItemRecords({ sql }: RecordsInput): InboxItemRecords {
  return {
    receiveInboxItem: (input) => receiveInboxItem({ sql, ...input }),
    inboxItem: (input) => inboxItem({ sql, ...input }),
    itemTurn: (input) => itemTurn({ sql, ...input }),
    writeInboxItem: (input) => writeInboxItem({ sql, ...input }),
    pendingInboxItems: () => pendingInboxItems({ sql }),
  };
}

function receiveInboxItem({ sql, inboxItem: received }: SqlCall<ReceiveInboxItemInput>): void {
  const row = Schema.encodeSync(InboxItemRow)(received);

  sql.exec(
    'INSERT INTO inbox_items (id, text, delivery, sender_id, received_at_ms, received_sequence) VALUES (?, ?, ?, ?, ?, ?)',
    row.id,
    row.text,
    row.delivery,
    row.sender_id,
    row.received_at_ms,
    row.received_sequence,
  );
}

function inboxItem({ sql, inboxItemId }: SqlCall<InboxItemIdInput>): Option.Option<InboxItemRow> {
  const cursor = sql.exec(
    'SELECT id, text, delivery, sender_id, received_at_ms, received_sequence FROM inbox_items WHERE id = ?',
    inboxItemId,
  );

  return decodeFirst({ cursor, schema: InboxItemRow });
}

/** pi moves only the items the mech received and submitted under their ids, so a missing item is a defect. */
function itemTurn({ sql, inboxItemId }: SqlCall<InboxItemIdInput>): Option.Option<TurnId> {
  const cursor = sql.exec('SELECT turn_id FROM inbox_items WHERE id = ?', inboxItemId);

  return decodeOne({ cursor, schema: ItemTurnRow }).turnId;
}

function writeInboxItem({ sql, inboxItemId, now }: SqlCall<WriteInboxItemInput>): Option.Option<string> {
  const cursor = sql.exec(
    'UPDATE inbox_items SET written_at_ms = ? WHERE id = ? AND written_at_ms IS NULL RETURNING id',
    DateTime.toEpochMillis(now),
    inboxItemId,
  );

  return Option.map(decodeFirst({ cursor, schema: IdRow }), ({ id }) => id);
}

function pendingInboxItems({ sql }: RecordsInput): ReadonlyArray<PendingItemRow> {
  const cursor = sql.exec(
    'SELECT id, text, delivery, received_at_ms FROM inbox_items WHERE (turn_id IS NULL AND written_at_ms IS NULL) OR turn_id = (SELECT id FROM turns WHERE status = ?) ORDER BY received_at_ms',
    TurnStatus.Running,
  );

  return decodeRows({ cursor, schema: PendingItemRow });
}
