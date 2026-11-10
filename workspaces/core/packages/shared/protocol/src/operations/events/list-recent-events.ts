import { Schema } from 'effect';
import type { Operation } from '../../operation/types.ts';
import { MEMBER_MECH_READ } from '../mech-read.ts';
import { EventCursor, EventPage } from './schemas.ts';

const BeforeCursor = Schema.OptionFromOptionalKey(EventCursor);

/** A recent page in chronological order; hasMore means older events precede it. */
export const listRecentEvents = {
  ...MEMBER_MECH_READ,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/events/recent',
  query: Schema.Struct({ before: BeforeCursor }),
  output: EventPage,
} as const satisfies Operation;
