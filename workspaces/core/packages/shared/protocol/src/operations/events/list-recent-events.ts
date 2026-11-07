import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { EventCursor, EventPage } from './schemas.ts';

const BeforeCursor = Schema.OptionFromOptionalKey(EventCursor);

/** A recent page in chronological order; hasMore means older events precede it. */
export const listRecentEvents = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/events/recent',
  access: Access.Member,
  params: MechPath,
  query: Schema.Struct({ before: BeforeCursor }),
  body: NoFields,
  output: EventPage,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;
