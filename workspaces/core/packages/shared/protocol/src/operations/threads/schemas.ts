import { memberOrUnknown, PAGE_RENAMES, RecordName, renamedWireStruct, ThreadId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { ThreadState } from './constants.ts';

/** A thread of a mech's work: its title and state, its note, none until the mech writes one, and when it changed. */
export const Thread = wireStruct({
  fields: {
    id: ThreadId,
    title: RecordName,
    state: memberOrUnknown({ set: ThreadState }),
    /** None until the mech writes a note, which the wire sends as null. */
    note: Schema.OptionFromNullOr(RecordName),
    openedAt: WireTime,
    updatedAt: WireTime,
  },
});

export type Thread = typeof Thread.Type;

/** A mech's threads, oldest first. */
export const ThreadList = Schema.Struct({ threads: Schema.Array(Thread) });

export type ThreadList = typeof ThreadList.Type;

/** One page of a mech's threads, oldest first, and whether more follow it. */
export const ThreadPage = renamedWireStruct({
  fields: { ...ThreadList.fields, hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type ThreadPage = typeof ThreadPage.Type;
