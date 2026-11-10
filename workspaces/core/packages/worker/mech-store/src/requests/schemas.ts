import { ExternalRequestKind, ExternalRequestStatus } from '@mechane/protocol';
import { ExternalRequestId, InboxItemId, RecordText, renamedWireStruct, ThreadId } from '@mechane/records';
import { Schema } from 'effect';

/** The frozen remote request survives replay so retries keep the same identity and payload. */
export const RequestSubmissionRow = renamedWireStruct({
  fields: {
    taskId: Schema.Int,
    threadId: ThreadId,
    requestId: ExternalRequestId,
    serviceIdentity: RecordText,
    body: RecordText,
  },
  renames: { taskId: 'pi_task_id' },
});

export type RequestSubmissionRow = typeof RequestSubmissionRow.Type;

/** A request wait retains polling and terminal state for its one thread continuation. */
export const RequestWaitRow = renamedWireStruct({
  fields: {
    taskId: Schema.Int,
    threadId: ThreadId,
    inboxItemId: InboxItemId,
    kind: Schema.Enum(ExternalRequestKind),
    requestId: ExternalRequestId,
    serviceIdentity: RecordText,
    expiresAt: Schema.DateTimeUtcFromMillis,
    /** Absent after cancellation or a terminal result; the host no longer polls this wait. */
    nextPollAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    /** Absent until settlement, including waits canceled before any terminal result. */
    result: Schema.OptionFromNullOr(Schema.fromJsonString(ExternalRequestStatus)),
  },
  renames: { taskId: 'pi_task_id', expiresAt: 'expires_at_ms', nextPollAt: 'next_poll_at_ms' },
});

export type RequestWaitRow = typeof RequestWaitRow.Type;
