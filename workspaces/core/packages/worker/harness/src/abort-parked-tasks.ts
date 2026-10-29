import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { HarnessHandle } from './types.ts';

/** How pi's inspection shows a task it parked: blocked by its restart limit, which this harness compares by member. */
const PiParkedState = { Kind: 'blocked', Reason: 'restart_limit' } as const;

/**
 * Marks aborted each task pi parked after resets cut it off five times in a row, as pi's stored tasks show it. Only an
 * open parks a task, and scheduling is still paused, so the mark runs nothing and pi counts the task as work for the
 * alarm. An aborted model request then ends its turn faulted, and an aborted tool call tells the model so.
 */
export async function abortParkedTasks({ harness }: HarnessHandle): Promise<void> {
  const { tasks } = await harness.inspect(BACKGROUND_CONTEXT);

  const parked = tasks.filter(
    ({ state }) => state.kind === PiParkedState.Kind && state.reason === PiParkedState.Reason,
  );

  for (const { record } of parked) {
    await harness.abortTask(record.id, BACKGROUND_CONTEXT);
  }
}
