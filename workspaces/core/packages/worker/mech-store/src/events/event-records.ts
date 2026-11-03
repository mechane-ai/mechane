import { Event, EventType, ListedEvent, REPLY_EXCERPT_MAX_CHARS } from '@mechane/protocol';
import type { TurnReplyExcerpt } from '@mechane/protocol';
import { RecordText, Sequence } from '@mechane/records';
import { decodeFirst, decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, RowsPage, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import type {
  AppendEventInput,
  EventRecords,
  EventsAfterInput,
  EventsBeforeInput,
  TurnEventsAfterInput,
} from '../types.ts';

/**
 * The most events one page of a mech's log holds. Every page says whether more follow, so no client reads it, and a
 * later deployment may change it.
 */
const EVENTS_PER_PAGE = 100;

/** One event of the log, as `/api/v1` encodes it. */
const EventRow = Schema.Struct({ event: Schema.String });

type EventRow = typeof EventRow.Type;

/** The sequence the log's next event takes. */
const SequenceRow = Schema.Struct({ sequence: Sequence });

type SequenceRow = typeof SequenceRow.Type;

/** An event as the log stores it: the JSON of its `/api/v1` encoding. */
const StoredEvent = Schema.fromJsonString(Event);

type StoredEvent = typeof StoredEvent.Type;

/** The record functions of a mech's log, which every change of the mech appends its event to. */
export function eventRecords({ sql }: RecordsInput): EventRecords {
  return {
    appendEvent: (input) => appendEvent({ sql, ...input }),
    eventsAfter: (input) => eventsAfter({ sql, ...input }),
    eventsBefore: (input) => eventsBefore({ sql, ...input }),
    turnEvents: (input) => turnEvents({ sql, ...input }),
    turnReplyExcerpt: (input) => turnReplyExcerpt({ sql, ...input }),
    lastSequence: () => lastSequence({ sql }),
  };
}

const ReplyEventRow = Schema.Struct({
  event: Schema.fromJsonString(Schema.Struct({ sequence: Sequence, reply: RecordText })),
});

/** A terminal reply can follow several event pages. Read its receipt by turn in the same transaction as the outcome. */
function turnReplyExcerpt({
  sql,
  turnId,
}: SqlCall<Pick<TurnEventsAfterInput, 'turnId'>>): Option.Option<TurnReplyExcerpt> {
  const cursor = sql.exec(
    "SELECT event FROM events WHERE json_extract(event, '$.turn_id') = ? AND json_extract(event, '$.type') = ? AND json_type(event, '$.reply') = 'text' ORDER BY sequence DESC LIMIT 1",
    turnId,
    EventType.TurnAnswered,
  );

  const recorded = decodeFirst({ cursor, schema: ReplyEventRow });

  return Option.map(recorded, ({ event }) => {
    const prefix = event.reply.slice(0, REPLY_EXCERPT_MAX_CHARS);
    let text = prefix;

    if (!prefix.isWellFormed()) {
      text = prefix.slice(0, -1);
    }

    return { sequence: event.sequence, text, isTruncated: text.length < event.reply.length };
  });
}

const RecentEventRow = Schema.Struct({ event: Schema.fromJsonString(ListedEvent) });

/** The indexed union includes the original input, even when it arrived before this turn began. */
function turnEvents({ sql, turnId, after }: SqlCall<TurnEventsAfterInput>): RowsPage<ListedEvent> {
  const cursor = sql.exec(
    "SELECT event FROM events WHERE sequence > ? AND (json_extract(event, '$.turn_id') = ? OR json_extract(event, '$.inbox_item_id') IN (SELECT id FROM inbox_items WHERE turn_id = ?)) ORDER BY sequence LIMIT ?",
    after,
    turnId,
    turnId,
    EVENTS_PER_PAGE + 1,
  );

  const events = decodeRows({ cursor, schema: RecentEventRow }).map(({ event }) => event);

  return { rows: events.slice(0, EVENTS_PER_PAGE), hasMore: events.length > EVENTS_PER_PAGE };
}

function eventsBefore({ sql, before }: SqlCall<EventsBeforeInput>): RowsPage<ListedEvent> {
  const cursorBefore = Option.getOrNull(before);

  const cursor = sql.exec(
    'SELECT event FROM events WHERE (? IS NULL OR sequence < ?) ORDER BY sequence DESC LIMIT ?',
    cursorBefore,
    cursorBefore,
    EVENTS_PER_PAGE + 1,
  );

  const events = decodeRows({ cursor, schema: RecentEventRow }).map(({ event }) => event);

  return { rows: events.slice(0, EVENTS_PER_PAGE).toReversed(), hasMore: events.length > EVENTS_PER_PAGE };
}

/**
 * Appends the event under the sequence after the log's last, and answers that sequence. Every host transaction queues
 * behind the one before, so appends never interleave, and the log is dense and in commit order.
 */
function appendEvent({ sql, event, now }: SqlCall<AppendEventInput>): Sequence {
  const sequence = Sequence.make(lastSequence({ sql }) + 1);
  // The mech built the event to its schema's type, so encoding it cannot fail.
  const text = Schema.encodeSync(StoredEvent)({ ...event, sequence, occurredAt: now });

  sql.exec('INSERT INTO events (sequence, event) VALUES (?, ?)', sequence, text);

  return sequence;
}

/** Reads one event past the page, which tells whether more follow it. */
function eventsAfter({ sql, after }: SqlCall<EventsAfterInput>): RowsPage<string> {
  const cursor = sql.exec(
    'SELECT event FROM events WHERE sequence > ? ORDER BY sequence LIMIT ?',
    after,
    EVENTS_PER_PAGE + 1,
  );

  const events = decodeRows({ cursor, schema: EventRow }).map(({ event }) => event);

  return { rows: events.slice(0, EVENTS_PER_PAGE), hasMore: events.length > EVENTS_PER_PAGE };
}

function lastSequence({ sql }: RecordsInput): Sequence {
  const cursor = sql.exec('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events');

  return decodeOne({ cursor, schema: SequenceRow }).sequence;
}
