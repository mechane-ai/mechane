import type { ExternalRequestId, ThreadId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Option } from 'effect';
import type { TaskIdInput } from '../task.types.ts';
import { RequestSubmissionRow } from './schemas.ts';

type BeginRequestSubmissionInput = TaskIdInput & {
  readonly threadId: ThreadId;
  readonly requestId: ExternalRequestId;
  readonly serviceIdentity: string;
  readonly body: string;
  readonly now: DateTime.Utc;
};

/** Saves the request identity before transport so a lost response cannot create another approval. */
export function requestSubmissionRecords({ sql }: RecordsInput) {
  function requestSubmission({ taskId }: TaskIdInput): Option.Option<RequestSubmissionRow> {
    const cursor = sql.exec(
      'SELECT pi_task_id, thread_id, request_id, service_identity, body FROM request_submissions WHERE pi_task_id = ?',
      taskId,
    );

    return decodeFirst({ cursor, schema: RequestSubmissionRow });
  }

  function beginRequestSubmission({
    taskId,
    threadId,
    requestId,
    serviceIdentity,
    body,
    now,
  }: BeginRequestSubmissionInput): RequestSubmissionRow {
    const prior = requestSubmission({ taskId });

    if (Option.isSome(prior)) {
      return prior.value;
    }

    const createdAt = DateTime.toEpochMillis(now);

    sql.exec(
      'INSERT INTO request_submissions (pi_task_id, thread_id, request_id, service_identity, body, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)',
      taskId,
      threadId,
      requestId,
      serviceIdentity,
      body,
      createdAt,
    );

    return { taskId, threadId, requestId, serviceIdentity, body };
  }

  return { requestSubmission, beginRequestSubmission };
}
