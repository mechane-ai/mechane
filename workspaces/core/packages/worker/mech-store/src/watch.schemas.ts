import { WATCH_RECORD_FIELDS } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A saved watch with millisecond storage times and its last check outcome. */
export const WatchRow = renamedWireStruct({
  fields: {
    ...WATCH_RECORD_FIELDS,
    nextRunAt: Schema.DateTimeUtcFromMillis,
    createdAt: Schema.DateTimeUtcFromMillis,
    updatedAt: Schema.DateTimeUtcFromMillis,
    /** Absent until a check finishes or reaches its deadline. */
    lastCheckedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
  renames: {
    nextRunAt: 'next_run_at_ms',
    createdAt: 'created_at_ms',
    updatedAt: 'updated_at_ms',
    lastCheckedAt: 'last_checked_at_ms',
  },
});

export type WatchRow = typeof WatchRow.Type;
