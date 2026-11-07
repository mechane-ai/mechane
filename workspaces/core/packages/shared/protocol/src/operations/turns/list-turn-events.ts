import { HttpMethod } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { TurnNotFound } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { EventCursor, EventPage } from '../events/schemas.ts';
import { TurnPath } from './schemas.ts';

const TurnEventsQuery = Schema.Struct({
  /** Absent before the turn's first event. */
  after: EventCursor.pipe(Schema.withDecodingDefaultKey(Effect.succeed('0'))),
});

/** The turn's events and the receipt of its inbox items, paged in commit order. */
export const listTurnEvents = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/turns/:turn_id/events',
  access: Access.Member,
  params: TurnPath,
  query: TurnEventsQuery,
  body: NoFields,
  output: EventPage,
  errors: [MechNotFound, TurnNotFound, ServiceUnavailable],
} as const satisfies Operation;
