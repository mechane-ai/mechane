import type { Context } from '@earendil-works/chord/context';
import type { RunningTask, TaskRuntime } from '@earendil-works/pi-durable';

type NotificationCheckpoint = { readonly phase: string };

export async function abortNotificationTask<
  Input,
  Checkpoint extends NotificationCheckpoint,
  Result,
  Hooks extends object,
>(
  _task: RunningTask<Input, Checkpoint, Result>,
  runtime: TaskRuntime<Input, Checkpoint, Result, Hooks>,
  context: Context,
): Promise<void> {
  await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context);
}
