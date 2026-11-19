import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { appendManagedEvent, importManagedThreadEvent, readManagedEvent } from '../event-log/write.ts';
import { ManagedWireObject } from '../protocol.ts';
import type { ManagedEvent } from '../protocol.ts';
import { readManagedThread } from '../thread-records.ts';
import { transitionManagedThread } from '../thread-state.ts';
import { observeChildCall, observeChildResult, processChildEcho } from './inputs.ts';

export type DelegatedThread = {
  readonly sessionId: string;
  readonly threadId: string;
  readonly parentThreadId: string;
  readonly agentName: string;
  readonly parentName: string;
};

export type DelegationProjection = {
  readonly report?: string;
  readonly reportEventId?: string;
  readonly failureEventId?: string;
  readonly isFinished?: boolean;
  readonly error?: string;
  readonly isInterrupted?: boolean;
};

type Candidate = { readonly messageId: string; readonly isInterrupted: boolean; readonly hasStarted: boolean };

const ReportCandidate = defineDocFamily<Candidate, null>({
  kind: 'managed.delegation-report-candidate',
  version: 1,
  scope: 'session',
  checkpointWhen: () => true,
  family: true,
  initial: (_seed: null) => ({ messageId: '', isInterrupted: false, hasStarted: false }),
});

const Content = Schema.Array(
  Schema.Union([
    Schema.Struct({ type: Schema.Literal('text'), text: Schema.String }),
    Schema.Struct({ type: Schema.Literal('redacted') }),
  ]),
);

type Publish = { readonly origin: DelegatedThread; readonly sourceId: string; readonly messageId: string };

async function publishReport(transaction: Tx, { origin, sourceId, messageId }: Publish): Promise<DelegationProjection> {
  if (messageId.length === 0) {
    return { isFinished: true };
  }

  const message = await readManagedEvent(transaction, origin.sessionId, messageId);

  if (message?.type !== 'agent.message') {
    throw new Error('The delegated thread lost its reply event.');
  }

  const content = Schema.decodeUnknownSync(Content)(message['content']);

  const report = content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  if (report.trim().length === 0) {
    return { isFinished: true };
  }

  const parent = await readManagedThread(transaction, origin.sessionId, origin.parentThreadId);
  let destination: string | null = origin.parentThreadId;
  const recipient: { to_agent_name?: string } = {};

  if (parent['parent_thread_id'] === null) {
    destination = null;
  } else {
    recipient.to_agent_name = origin.parentName;
  }

  const receipt = JSON.stringify([origin.sessionId, origin.threadId, sourceId]);

  await appendManagedEvent(
    transaction,
    { sessionId: origin.sessionId, threadId: origin.threadId, stableKey: `report-sent:${receipt}` },
    { type: 'agent.thread_message_sent', to_session_thread_id: origin.parentThreadId, ...recipient, content },
  );

  const received = await appendManagedEvent(
    transaction,
    { sessionId: origin.sessionId, threadId: destination, stableKey: `report-received:${receipt}` },
    {
      type: 'agent.thread_message_received',
      from_session_thread_id: origin.threadId,
      from_agent_name: origin.agentName,
      content,
    },
  );

  return { isFinished: true, report, reportEventId: received.id };
}

export async function projectDelegatedEvent(
  transaction: Tx,
  origin: DelegatedThread,
  event: ManagedEvent,
): Promise<DelegationProjection> {
  if (event.processed_at === null) {
    throw new Error('A delegated event must be processed before delivery.');
  }

  const { sessionId, threadId } = origin;
  const thread = await readManagedThread(transaction, sessionId, threadId);

  if (thread['parent_thread_id'] !== origin.parentThreadId) {
    throw new Error('The delegated event does not belong to this parent thread.');
  }

  if (thread['archived_at'] !== null) {
    return { isInterrupted: true };
  }

  const key = JSON.stringify([sessionId, threadId]);
  const candidate = await transaction.doc(ReportCandidate, key, null);
  const failed: { failureEventId?: string } = {};

  function recordFailure(lifecycle: ManagedEvent): void {
    failed.failureEventId = lifecycle.id;
  }

  switch (event.type) {
    case 'session.status_running':
      candidate.hasStarted = true;
      candidate.messageId = '';

      await transitionManagedThread(transaction, { sessionId, threadId, status: 'running' });

      break;
    case 'session.status_terminated':
      await transitionManagedThread(transaction, { sessionId, threadId, status: 'terminated', onEvent: recordFailure });

      if (candidate.isInterrupted) {
        return { isInterrupted: true };
      }

      return { ...failed, isFinished: true, error: 'The delegated thread terminated.' };
    case 'session.status_idle': {
      if (!candidate.hasStarted) {
        return {};
      }

      const reason = Schema.decodeUnknownSync(ManagedWireObject)(event['stop_reason']);

      await transitionManagedThread(transaction, {
        sessionId,
        threadId,
        status: 'idle',
        stopReason: reason,
        onEvent: recordFailure,
      });

      if (candidate.isInterrupted) {
        return { isInterrupted: true };
      }

      switch (reason['type']) {
        case 'end_turn':
          return await publishReport(transaction, { origin, sourceId: event.id, messageId: candidate.messageId });
        case 'refusal':
          return { ...failed, isFinished: true, error: 'The delegated thread refused the task.' };
        case 'retries_exhausted':
          return { ...failed, isFinished: true, error: 'The delegated thread exhausted its retries.' };
        default:
          return {};
      }
    }
    case 'agent.thread_message_received':
      if (!(await processChildEcho(transaction, { sessionId, threadId }, event))) {
        throw new Error('The child reported an unacknowledged coordinator message.');
      }

      candidate.isInterrupted = false;
      candidate.messageId = '';
      break;
    case 'user.message':
      candidate.isInterrupted = false;
      candidate.messageId = '';
      break;
    case 'user.interrupt':
    case 'user.custom_tool_result':
    case 'user.tool_result':
    case 'user.tool_confirmation':
      if (event.type === 'user.interrupt') {
        candidate.isInterrupted = true;
      }

      if (!(await processChildEcho(transaction, { sessionId, threadId }, event))) {
        await importManagedThreadEvent(transaction, { sessionId, threadId }, event);
      }

      break;
    case 'agent.message':
      await importManagedThreadEvent(transaction, { sessionId, threadId }, event);

      candidate.messageId = event.id;
      break;
    case 'agent.tool_use':
    case 'agent.mcp_tool_use':
    case 'agent.custom_tool_use':
      candidate.messageId = '';

      await importManagedThreadEvent(transaction, { sessionId, threadId }, event);
      await observeChildCall(transaction, { sessionId, threadId }, event);

      break;
    case 'agent.tool_result':
    case 'agent.mcp_tool_result':
      await observeChildResult(transaction, { sessionId, threadId }, event);
      await importManagedThreadEvent(transaction, { sessionId, threadId }, event);

      break;
    case 'agent.thinking':
    case 'agent.thread_context_compacted':
    case 'span.model_request_start':
    case 'span.model_request_end':
    case 'session.error':
      await importManagedThreadEvent(transaction, { sessionId, threadId }, event);

      break;
    default:
      break;
  }

  return {};
}
