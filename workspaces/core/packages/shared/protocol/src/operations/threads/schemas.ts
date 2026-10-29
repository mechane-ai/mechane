import {
  memberOrUnknown,
  PAGE_RENAMES,
  PrintableName,
  RecordName,
  renamedWireStruct,
  ThreadId,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { THREAD_NOTE_MAX_CHARS, THREAD_TITLE_MAX_CHARS, ThreadState } from './constants.ts';

/** What a thread is about, which its mech chose when it opened it. */
export const ThreadTitle = PrintableName.check(Schema.isBetweenLength(1, THREAD_TITLE_MAX_CHARS));

export type ThreadTitle = typeof ThreadTitle.Type;

/** Where a thread's work stands, as its mech last wrote it. */
export const ThreadNote = PrintableName.check(Schema.isBetweenLength(1, THREAD_NOTE_MAX_CHARS));

export type ThreadNote = typeof ThreadNote.Type;

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
