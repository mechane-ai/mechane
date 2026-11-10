import { ExecutionStatus } from '@mechane/sandbox-store';
import type { ExecutionRow } from '@mechane/sandbox-store';
import { ExecutionEnvironmentRequired } from '@mechane/sandbox-wire';
import type { ExecutionAttempt, ExecutionEnvironment } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { readyWorkspaceMachine } from '../machines/ready-workspace-machine.ts';
import type { StatusOf, WorkspaceProviderStepInput } from '../types.ts';
import { hasUncheckpointedMachineLoss } from '../workspace/has-uncheckpointed-machine-loss.ts';
import { askGuest } from './ask-guest.ts';
import { executionProgress } from './execution-progress.ts';

/** A pending execution, as the store holds it. */
type PendingExecution = Extract<ExecutionRow, StatusOf<typeof ExecutionStatus.Pending>>;

/** A pending execution to send, and the time by which the call answers that it still runs. */
type DispatchPendingInput = WorkspaceProviderStepInput & {
  readonly environment: ExecutionEnvironment;
  readonly execution: PendingExecution;
  readonly deadline: DateTime.Utc;
};

/**
 * Sends a pending execution to the live machine, starting one when none is live, once that machine's guest answers its
 * health; health proves the execution was never sent before. Until the call's deadline passes without health, the
 * execution stays pending, and a later join must supply a fresh execution environment.
 */
export async function dispatchPending({
  store,
  provider,
  workspace,
  execution,
  deadline,
  environment,
}: DispatchPendingInput): Promise<ExecutionAttempt> {
  const machine = await readyWorkspaceMachine({ store, provider, workspace, deadline });

  if (Option.isNone(machine)) {
    if (hasUncheckpointedMachineLoss({ store })) {
      store.refusePendingExecution({ executionId: execution.id });
    }

    const current = store.execution({ executionId: execution.id });

    if (Option.isSome(current) && current.value.status !== ExecutionStatus.Pending) {
      return executionProgress({ execution: current.value });
    }

    return ExecutionEnvironmentRequired.make({});
  }

  store.dispatchExecution({ executionId: execution.id, machineId: machine.value.id, now: DateTime.nowUnsafe() });

  // The claim wrote the execution's row, which nothing deletes.
  const dispatched = Option.getOrThrow(store.execution({ executionId: execution.id }));

  if (dispatched.status === ExecutionStatus.Dispatched) {
    const granted = Option.some(environment);

    return await askGuest({ store, provider, workspace, execution: dispatched, deadline, environment: granted });
  }

  return executionProgress({ execution: dispatched });
}
