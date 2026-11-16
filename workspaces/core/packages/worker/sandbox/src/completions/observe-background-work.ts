import { ExecutionStatus, MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import { runExecution } from '../executions/run-execution.ts';
import { observeMachine } from '../machines/observe-machine.ts';
import { readyWorkspaceMachine } from '../machines/ready-workspace-machine.ts';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import { listManagedProcesses } from '../processes/list-managed-processes.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';

/** Observing accepted work never supplies credentials, dispatches a pending command, or renews the idle deadline. */
export async function observeBackgroundWork({ store, provider, workspace }: WorkspaceProviderStepInput): Promise<void> {
  const input = { store, provider, workspace };

  const isWorkspaceReady = await advanceWorkspace({ ...input, shouldAdmitCommand: false });

  await observeMachine(input);

  const live = store.liveMachine();
  const starting = Option.filter(live, (machine) => machine.status === MachineStatus.Starting);
  const pending = store.latestPendingExecutionAt();
  const isWaitingForStartup = Option.isSome(starting) && Option.isSome(pending);

  if (isWorkspaceReady && isWaitingForStartup && !maintenanceActive({ store })) {
    const drain = store.machineDrain({ machineId: starting.value.id });

    if (Option.isNone(drain)) {
      const deadline = DateTime.nowUnsafe();

      await readyWorkspaceMachine({ ...input, deadline });
    }
  }

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
