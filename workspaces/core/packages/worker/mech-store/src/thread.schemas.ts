import { ThreadState } from '@mechane/protocol';
import { renamedWireStruct, ThreadId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A thread as its mech last updated it. */
export const ThreadRow = renamedWireStruct({
  fields: {
    id: ThreadId,
    title: Schema.String,
    state: Schema.Enum(ThreadState),
    /** None until the mech writes one. */
    note: Schema.OptionFromNullOr(Schema.String),
    openedAt: Schema.DateTimeUtcFromMillis,
    updatedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { openedAt: 'opened_at_ms', updatedAt: 'updated_at_ms' },
});

export type ThreadRow = typeof ThreadRow.Type;

/** A page of the mech's threads as the store reads them, oldest first, or a cursor that names no thread of its own. */
export const ThreadRowPage = Schema.TaggedUnion({
  Listed: { threads: Schema.Array(Schema.toType(ThreadRow)), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type ThreadRowPage = typeof ThreadRowPage.Type;

/** A thread not resolved yet, as the mech's prompt lists it, with how many of its drones run. */
export const OpenThreadRow = wireStruct({
  fields: {
    id: ThreadId,
    title: Schema.String,
    state: Schema.Enum(ThreadState),
    /** None until the mech writes one. */
    note: Schema.OptionFromNullOr(Schema.String),
    runningDrones: Schema.Int,
  },
});

export type OpenThreadRow = typeof OpenThreadRow.Type;
