import type { Tx } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { actorRecordCollection } from '../../actor/record-store.ts';
import type { ManagedEvent } from '../protocol.ts';

export function workerEvents(sessionId: string) {
  return actorRecordCollection(`managed.worker-events:${sessionId}`, Schema.String);
}

const workerEventTypes: ReadonlySet<string> = new Set([
  'agent.tool_use',
  'agent.custom_tool_use',
  'user.tool_result',
  'user.custom_tool_result',
  'session.status_running',
  'session.status_idle',
  'session.status_terminated',
  'session.deleted',
  'session.thread_status_running',
  'session.thread_status_idle',
  'session.thread_status_rescheduled',
  'session.thread_status_terminated',
]);

export async function indexWorkerEvent(transaction: Tx, sessionId: string, event: ManagedEvent): Promise<void> {
  if (event.processed_at === null) {
    return;
  }

  const index = workerEvents(sessionId);

  if (event.type === 'user.tool_confirmation') {
    const callId = event['tool_use_id'];

    if (typeof callId !== 'string' || (await index.read(transaction, callId)) === undefined) {
      return;
    }
  } else if (!workerEventTypes.has(event.type)) {
    return;
  }

  await index.put(transaction, event.id, event.id);
}
