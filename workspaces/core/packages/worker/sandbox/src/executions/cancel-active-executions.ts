import type { ProviderStepInput } from '../types.ts';
import { cancelExecution } from './cancel-execution.ts';

/** The host calls this before closing a canceled turn's note, while no later turn can dispatch commands. */
export async function cancelActiveExecutions({ store, provider }: ProviderStepInput): Promise<void> {
  const executions = store.unfinishedExecutions();

  for (const execution of executions) {
    store.cancelPendingExecution({ executionId: execution.id });
  }

  for (const execution of executions) {
    await cancelExecution({ store, provider, executionId: execution.id });
  }
}
