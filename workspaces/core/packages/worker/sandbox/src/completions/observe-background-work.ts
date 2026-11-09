import { ExecutionStatus } from '@mechane/sandbox-store';
import { Duration, Option } from 'effect';
import { runExecution } from '../executions/run-execution.ts';
import { observeMachine } from '../machines/observe-machine.ts';
import { listManagedProcesses } from '../processes/list-managed-processes.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';

/** Observing accepted work never supplies credentials, dispatches a pending command, or renews the idle deadline. */
export async function observeBackgroundWork({ store, provider, workspace }: WorkspaceProviderStepInput): Promise<void> {
  const input = { store, provider, workspace };

  await advanceWorkspace(input);
  await observeMachine(input);

  for (const execution of store.unfinishedExecutions()) {
    if (execution.status === ExecutionStatus.Dispatched) {
      const environment = Option.none();

      await runExecution({
        ...input,
        request: {
          executionId: execution.id,
          command: execution.command,
          timeout: execution.timeout,
          wait: Duration.zero,
        },
        environment,
      });
    }
  }

  await listManagedProcesses({ store, provider });
}
