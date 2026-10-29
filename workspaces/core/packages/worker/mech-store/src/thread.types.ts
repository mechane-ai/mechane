import type { ThreadState } from '@mechane/protocol';
import type { PageAfterInput } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type { TaskIdInput } from './task.types.ts';
import type { OpenThreadRow, ThreadRow, ThreadRowPage } from './thread.schemas.ts';

/** The thread a record function reads or changes. */
export type ThreadIdInput = { readonly threadId: string };

/** A thread an open_thread task opens, working from the start. */
export type OpenThreadInput = {
  readonly threadId: string;
  readonly taskId: number;
  readonly title: string;
  readonly now: DateTime.Utc;
};

/** A thread's new state and note. */
export type UpdateThreadInput = {
  readonly threadId: string;
  readonly state: ThreadState;
  /** Absent to keep the note the thread has. */
  readonly note: Option.Option<string>;
  readonly now: DateTime.Utc;
};

/** The record functions of a mech's threads. */
export type ThreadRecords = {
  /** The thread an open_thread task opened, which a rerun of the task answers. */
  readonly openedThread: (input: TaskIdInput) => Option.Option<ThreadRow>;
  /** How many of the mech's threads are not resolved. */
  readonly openThreadCount: () => number;
  readonly openThread: (input: OpenThreadInput) => void;
  /** The thread of the id, none for an id the mech never opened. */
  readonly thread: (input: ThreadIdInput) => Option.Option<ThreadRow>;
  readonly updateThread: (input: UpdateThreadInput) => void;
  /** A page of the mech's threads, oldest first, or a cursor that names no thread of its own. */
  readonly threads: (input: PageAfterInput) => ThreadRowPage;
  /** The threads not resolved, oldest first, each with how many of its drones run. */
  readonly openThreads: () => ReadonlyArray<OpenThreadRow>;
};
