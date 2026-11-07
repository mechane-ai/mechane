import { ExternalRequestStatus } from '@mechane/protocol';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import type { TaskIdInput } from '../task.types.ts';
import type { ThreadIdInput } from '../thread.types.ts';
import { threadContinuationRecords } from '../threads/thread-continuation-records.ts';
import { RequestWaitRow } from './schemas.ts';
import type { BeginRequestWaitInput, DeferRequestWaitInput, SettleRequestWaitInput } from './types.ts';

const RequestStatusJson = Schema.fromJsonString(ExternalRequestStatus);
const Deadline = Schema.Struct({ at: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis) });
const TaskRow = Schema.Struct({ pi_task_id: Schema.Int });
type DueInput = { readonly now: DateTime.Utc };

/** A wait owns polling; its existing thread update owns the one continuation and original reply route. */
export function requestWaitRecords({ sql }: RecordsInput) {
  const continuations = threadContinuationRecords({ sql });

  function requestWait({ taskId }: TaskIdInput): Option.Option<RequestWaitRow> {
    const cursor = sql.exec(
      'SELECT request_waits.pi_task_id, thread_updates.thread_id, thread_updates.inbox_item_id, request_waits.kind, request_waits.request_id, request_waits.service_identity, request_waits.expires_at_ms, request_waits.next_poll_at_ms, request_waits.result FROM request_waits JOIN thread_updates ON thread_updates.pi_task_id = request_waits.pi_task_id WHERE request_waits.pi_task_id = ?',
      taskId,
    );

    return decodeFirst({ cursor, schema: RequestWaitRow });
  }

  function cancelThreadRequestWait({ threadId }: ThreadIdInput): void {
    sql.exec(
      'UPDATE request_waits SET next_poll_at_ms = NULL WHERE pi_task_id IN (SELECT pi_task_id FROM thread_updates WHERE thread_id = ?)',
      threadId,
    );
    sql.exec(
      'UPDATE thread_updates SET resume_at_ms = NULL WHERE thread_id = ? AND pi_task_id IN (SELECT pi_task_id FROM request_waits)',
      threadId,
    );
  }

  function beginRequestWait({
    taskId,
    threadId,
    kind,
    requestId,
    serviceIdentity,
    inboxItemId,
    now,
    expiresAt,
  }: BeginRequestWaitInput): RequestWaitRow {
    const prior = requestWait({ taskId });

    if (Option.isSome(prior)) {
      return prior.value;
    }

    cancelThreadRequestWait({ threadId });

    const resumeAt = Option.none<DateTime.Utc>();
    const expires = DateTime.toEpochMillis(expiresAt);
    const pollAt = DateTime.toEpochMillis(now);

    continuations.recordThreadUpdate({ taskId, threadId, inboxItemId, resumeAt });
    sql.exec(
      'INSERT INTO request_waits (pi_task_id, kind, request_id, service_identity, expires_at_ms, next_poll_at_ms) VALUES (?, ?, ?, ?, ?, ?)',
      taskId,
      kind,
      requestId,
      serviceIdentity,
      expires,
      pollAt,
    );

    return {
      taskId,
      threadId,
      kind,
      requestId,
      serviceIdentity,
      inboxItemId,
      expiresAt,
      nextPollAt: Option.some(now),
      result: Option.none(),
    };
  }

  function settleRequestWait({ taskId, result, now }: SettleRequestWaitInput): void {
    const encoded = Schema.encodeSync(RequestStatusJson)(result);
    const at = DateTime.toEpochMillis(now);

    const cursor = sql.exec(
      'UPDATE request_waits SET next_poll_at_ms = NULL, result = ? WHERE pi_task_id = ? AND next_poll_at_ms IS NOT NULL RETURNING pi_task_id',
      encoded,
      taskId,
    );

    const changed = decodeFirst({ cursor, schema: TaskRow });

    if (Option.isNone(changed)) {
      return;
    }

    sql.exec('UPDATE thread_updates SET resume_at_ms = ? WHERE pi_task_id = ?', at, taskId);
  }

  function deferRequestWait({ taskId, nextPollAt }: DeferRequestWaitInput): void {
    const at = DateTime.toEpochMillis(nextPollAt);

    sql.exec(
      'UPDATE request_waits SET next_poll_at_ms = MIN(?, expires_at_ms) WHERE pi_task_id = ? AND next_poll_at_ms IS NOT NULL',
      at,
      taskId,
    );
  }

  function dueRequestWaits({ now }: DueInput): ReadonlyArray<RequestWaitRow> {
    const at = DateTime.toEpochMillis(now);

    const cursor = sql.exec(
      'SELECT request_waits.pi_task_id, thread_updates.thread_id, thread_updates.inbox_item_id, request_waits.kind, request_waits.request_id, request_waits.service_identity, request_waits.expires_at_ms, request_waits.next_poll_at_ms, request_waits.result FROM request_waits JOIN thread_updates ON thread_updates.pi_task_id = request_waits.pi_task_id WHERE request_waits.next_poll_at_ms <= ? ORDER BY request_waits.next_poll_at_ms, request_waits.pi_task_id',
      at,
    );

    return decodeRows({ cursor, schema: RequestWaitRow });
  }

  function nextRequestWaitAt(): Option.Option<DateTime.Utc> {
    const cursor = sql.exec('SELECT MIN(next_poll_at_ms) AS at FROM request_waits');
    const row = decodeFirst({ cursor, schema: Deadline });

    return Option.flatMap(row, (deadline) => deadline.at);
  }

  return {
    requestWait,
    beginRequestWait,
    cancelThreadRequestWait,
    settleRequestWait,
    deferRequestWait,
    dueRequestWaits,
    nextRequestWaitAt,
  };
}
