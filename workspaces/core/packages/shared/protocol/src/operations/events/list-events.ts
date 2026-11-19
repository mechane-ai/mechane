import { DurationFromSeconds, HttpMethod, isBetweenDuration, renamedWireStruct } from '@mechane/records';
import { Duration, Effect, Schema } from 'effect';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { WAIT_MAX } from './constants.ts';
import { EventCursor, EventPage } from './schemas.ts';

/** How long a list may wait for its first event, which a query writes in whole seconds. */
const EventWait = Schema.NumberFromString.pipe(Schema.decodeTo(DurationFromSeconds)).check(
  isBetweenDuration({ minimum: Duration.zero, maximum: WAIT_MAX }),
);

const fromBeginning = Schema.withDecodingDefaultKey<typeof EventCursor>(Effect.succeed('0'));
/** Sequence used by historical log readers. Omitting it starts at the beginning of the log. */
export const LogEventCursor = EventCursor.pipe(fromBeginning);

/** The events to list: those after `after`, waiting up to `wait` while there are none. */
const EventQuery = renamedWireStruct({
  fields: {
    /** Absent at the log's start, as an absent cursor is on every list. */
    after: LogEventCursor,
    /** Absent for a list that does not wait. */
    wait: EventWait.pipe(Schema.withDecodingDefaultKey(Effect.succeed('0'))),
  },
  renames: { wait: 'wait_seconds' },
});

/**
 * Lists the events of a mech's log after a sequence, a page at a time. While the log holds none after it, the list
 * waits up to `wait_seconds` for one. A cursor past the log's end waits like one at its end.
 */
export const listEvents = {
  method: HttpMethod.Get,
  path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/events',
  access: Access.Owner,
  params: MechPath,
  query: EventQuery,
  body: NoFields,
  output: EventPage,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;
