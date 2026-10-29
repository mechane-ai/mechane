import { ExecutionStatus } from '@mechane/sandbox-store';
import type { ExecutionClaim, ExecutionRow } from '@mechane/sandbox-store';
import type { ExecutionProgress } from '@mechane/sandbox-wire';
import { DateTime, Option, Result } from 'effect';
import type { Duration } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceSandbox } from './advance-sandbox.ts';
import { askGuest } from './ask-guest.ts';
import { claimExecution } from './claim-execution.ts';
import { dispatchPending } from './dispatch-pending.ts';
import { executionProgress } from './execution-progress.ts';

/** An execution to run once under its id, and how long a call waits for it to settle. */
type ExecutionRun = ExecutionClaim & { readonly wait: Duration.Duration };

type RunExecutionInput = WorkspaceProviderStepInput & { readonly request: ExecutionRun };

/** The statuses of an execution whose receipt is not stored yet: a call observes its machine before it goes on. */
const UNSETTLED_STATUSES: ReadonlySet<ExecutionStatus> = new Set([ExecutionStatus.Pending, ExecutionStatus.Dispatched]);

/**
 * Runs an execution once in the sandbox, waiting at most the request's wait for it to settle. It claims the execution,
 * observes the live machine, sends a pending execution to a healthy machine, and asks only the machine it was sent to.
 * Every intent is stored before its effect, a repeated id answers from its receipt, and an unknown outcome never
 * reruns.
 */
export async function runExecution({
  store,
  provider,
  workspace,
  request,
}: RunExecutionInput): Promise<ExecutionProgress> {
  const { executionId, command, timeout, wait } = request;
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, wait);
  const claim = claimExecution({ store, request: { executionId, command, timeout }, now });
  // A known id that holds another request is a broken invariant, so the sandbox's RPC call rejects with its failure.
  const claimed = Result.getOrThrow(claim);

  if (!UNSETTLED_STATUSES.has(claimed.status)) {
    return executionProgress({ execution: claimed });
  }

  const canDispatch = await advanceSandbox({ store, provider, workspace, executionId: claimed.id, deadline });

  // The claim wrote the execution's row, which nothing deletes.
  const execution = Option.getOrThrow(store.execution({ executionId }));

  if (!canDispatch) {
    return executionProgress({ execution });
  }

  return await continueExecution({ store, provider, workspace, execution, deadline });
}

type ContinueExecutionInput = WorkspaceProviderStepInput & {
  readonly execution: ExecutionRow;
  readonly deadline: DateTime.Utc;
};

async function continueExecution({
  store,
  provider,
  workspace,
  execution,
  deadline,
}: ContinueExecutionInput): Promise<ExecutionProgress> {
  switch (execution.status) {
    case ExecutionStatus.Pending:
      return await dispatchPending({ store, provider, workspace, execution, deadline });
    case ExecutionStatus.Dispatched:
      return await askGuest({ store, provider, workspace, execution, deadline });
    case ExecutionStatus.Exited:
    case ExecutionStatus.TimedOut:
    case ExecutionStatus.Uncertain:
    case ExecutionStatus.Unavailable:
    case ExecutionStatus.PersistenceFailed:
      return executionProgress({ execution });
  }
}
