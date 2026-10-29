import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** One policy's window as the limiter stored it: when it opened, and the requests it took so far. */
export const LimitWindowRow = renamedWireStruct({
  fields: { openedAt: Schema.DateTimeUtcFromMillis, taken: Schema.Int },
  renames: { openedAt: 'opened_at_ms' },
});

export type LimitWindowRow = typeof LimitWindowRow.Type;
