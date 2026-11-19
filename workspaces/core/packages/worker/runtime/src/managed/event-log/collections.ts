import { defineDocFamily } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { actorRecordCollection } from '../../actor/record-store.ts';
import type { ManagedEventRow } from './payload-storage.ts';

export const EventClock = defineDocFamily({
  kind: 'mechane.managed-event-clock',
  version: 1,
  family: true,
  scope: 'session',
  initial: (_seed: null) => ({ sequence: 0, processedTime: 0 }),
  checkpointWhen: () => true,
});

export function stableEvents(sessionId: string) {
  const record = Schema.Struct({ id: Schema.String, digest: Schema.String });

  return actorRecordCollection(`managed-event-receipts:${sessionId}`, record);
}

export function indexedEvents(sessionId: string, threadId: string | null, state: 'processed' | 'pending') {
  return actorRecordCollection(JSON.stringify(['managed-event-index', sessionId, threadId, state]), Schema.String);
}

export function crossPosts(event: ManagedEventRow['event']): boolean {
  switch (event.type) {
    case 'session.thread_created':
    case 'session.thread_status_running':
    case 'session.thread_status_idle':
    case 'session.thread_status_terminated':
    case 'session.thread_status_rescheduled':
    case 'agent.custom_tool_use':
    case 'user.custom_tool_result':
    case 'user.tool_confirmation':
      return true;
    case 'agent.tool_use':
    case 'agent.mcp_tool_use':
      return event['evaluated_permission'] === 'ask';
    default:
      return false;
  }
}

export function visibleEvent(row: ManagedEventRow, threadId: string | null): ManagedEventRow['event'] {
  if (threadId === null && row.threadId !== null) {
    return { ...row.event, session_thread_id: row.threadId };
  }

  return row.event;
}
