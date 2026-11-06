import { ThreadNote, ThreadTitle } from '@mechane/protocol';
import { InboxItemId, renamedWireStruct, ThreadId } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';

type TaskInput = { readonly taskId: number };
type ThreadInput = { readonly threadId: ThreadId };
type ThreadOriginInput = ThreadInput & { readonly inboxItemId: InboxItemId };

type RecordUpdateInput = TaskInput &
  ThreadInput & {
    /** None clears any prior deadline without scheduling another wakeup. */
    readonly resumeAt: Option.Option<DateTime.Utc>;
    readonly inboxItemId: InboxItemId;
  };

type InboxInput = { readonly inboxItemId: InboxItemId };

type DueInput = { readonly now: DateTime.Utc };

const DueContinuation = renamedWireStruct({
  fields: {
    taskId: Schema.Int,
    threadId: ThreadId,
    inboxItemId: InboxItemId,
    title: ThreadTitle,
    note: Schema.OptionFromNullOr(ThreadNote),
  },
  renames: { taskId: 'pi_task_id' },
});

const Deadline = Schema.Struct({ at: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis) });
const TaskRow = Schema.Struct({ pi_task_id: Schema.Int });
const Origin = Schema.Struct({ inbox_item_id: InboxItemId });

/** A replayed tool update never creates a second wakeup; each thread retains its original reply destination. */
export function threadContinuationRecords({ sql }: RecordsInput) {
  return {
    hasThreadUpdate: ({ taskId }: TaskInput): boolean => {
      const cursor = sql.exec('SELECT pi_task_id FROM thread_updates WHERE pi_task_id = ?', taskId);

      const row = decodeFirst({ cursor, schema: TaskRow });

      return Option.isSome(row);
    },
    recordThreadOrigin: ({ threadId, inboxItemId }: ThreadOriginInput): void => {
      sql.exec(
        'INSERT INTO thread_origins (thread_id, inbox_item_id) VALUES (?, ?) ON CONFLICT (thread_id) DO NOTHING',
        threadId,
        inboxItemId,
      );
    },
    continuationOrigin: ({ inboxItemId }: InboxInput): Option.Option<InboxItemId> => {
      const cursor = sql.exec(
        'SELECT thread_origins.inbox_item_id FROM thread_updates JOIN thread_origins ON thread_origins.thread_id = thread_updates.thread_id WHERE thread_updates.inbox_item_id = ?',
        inboxItemId,
      );

      const row = decodeFirst({ cursor, schema: Origin });

      return Option.map(row, (origin) => origin.inbox_item_id);
    },
    recordThreadUpdate: ({ taskId, threadId, resumeAt, inboxItemId }: RecordUpdateInput): void => {
      sql.exec(
        'UPDATE thread_updates SET resume_at_ms = NULL WHERE thread_id = ? AND resume_at_ms IS NOT NULL',
        threadId,
      );

      const millis = Option.map(resumeAt, DateTime.toEpochMillis);
      const deadline = Option.getOrNull(millis);

      sql.exec(
        'INSERT INTO thread_updates (pi_task_id, thread_id, resume_at_ms, inbox_item_id) VALUES (?, ?, ?, ?)',
        taskId,
        threadId,
        deadline,
        inboxItemId,
      );
    },
    dueThreadContinuations: ({ now }: DueInput): ReadonlyArray<typeof DueContinuation.Type> => {
      const at = DateTime.toEpochMillis(now);

      const cursor = sql.exec(
        'SELECT thread_updates.pi_task_id, thread_updates.thread_id, thread_updates.inbox_item_id, threads.title, threads.note FROM thread_updates JOIN threads ON threads.id = thread_updates.thread_id WHERE thread_updates.resume_at_ms <= ? ORDER BY thread_updates.resume_at_ms, thread_updates.pi_task_id',
        at,
      );

      return decodeRows({ cursor, schema: DueContinuation });
    },
    finishThreadContinuation: ({ taskId }: TaskInput): void => {
      sql.exec('UPDATE thread_updates SET resume_at_ms = NULL WHERE pi_task_id = ?', taskId);
    },
    nextThreadContinuationAt: (): Option.Option<DateTime.Utc> => {
      const cursor = sql.exec('SELECT MIN(resume_at_ms) AS at FROM thread_updates');

      const row = decodeFirst({ cursor, schema: Deadline });

      return Option.flatMap(row, (deadline) => deadline.at);
    },
  };
}
