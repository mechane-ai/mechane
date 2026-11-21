import { LiveDoc } from '@earendil-works/pi-durable';
import type { TaskId, Tx } from '@earendil-works/pi-durable';
import { managedModelError } from '@mechane/model-gateway';
import { appendManagedEvent } from './event-log/write.ts';
import { LastModelFailure } from './model-spans.ts';

export async function recordManagedRetry(transaction: Tx, sessionId: string, taskId: TaskId): Promise<void> {
  const task = await transaction.task(taskId);

  if (task?.state.status !== 'running') {
    return;
  }

  const live = await transaction.doc(LiveDoc, task.conversationId);
  const attempt = live.generation?.attempt;

  if (attempt === undefined || attempt <= 1) {
    return;
  }

  const lastFailure = await transaction.doc(LastModelFailure, sessionId, null);

  let error: Readonly<Record<string, unknown>> = {
    type: 'unknown_error',
    message: 'The model request is being retried.',
    retry_status: { type: 'retrying' },
  };

  if (lastFailure.detail !== null) {
    error = managedModelError(lastFailure.detail, 'retrying');
  }

  await appendManagedEvent(
    transaction,
    { sessionId, stableKey: `model-retry:${taskId}:${attempt}` },
    { type: 'session.error', error },
  );
}
