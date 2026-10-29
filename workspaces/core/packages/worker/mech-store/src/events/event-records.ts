import { Event } from '@mechane/protocol';
import { Sequence } from '@mechane/records';
import { decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, RowsPage, SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import type { AppendEventInput, EventRecords, EventsAfterInput } from '../types.ts';

/**
 * The most events one page of a mech's log holds. Every page says whether more follow, so no client reads it, and a
 * later deployment may change it.
 */
const EVENTS_PER_PAGE = 100;

/** One event of the log, as `/v1` encodes it. */
const EventRow = Schema.Struct({ event: Schema.String });

type EventRow = typeof EventRow.Type;

/** The sequence the log's next event takes. */
const SequenceRow = Schema.Struct({ sequence: Sequence });

type SequenceRow = typeof SequenceRow.Type;

/** An event as the log stores it: the JSON of its `/v1` encoding. */
const StoredEvent = Schema.fromJsonString(Event);

type StoredEvent = typeof StoredEvent.Type;

/** The record functions of a mech's log, which every change of the mech appends its event to. */
export function eventRecords({ sql }: RecordsInput): EventRecords {
  return {
    appendEvent: (input) => appendEvent({ sql, ...input }),
    eventsAfter: (input) => eventsAfter({ sql, ...input }),
    lastSequence: () => lastSequence({ sql }),
  };
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
