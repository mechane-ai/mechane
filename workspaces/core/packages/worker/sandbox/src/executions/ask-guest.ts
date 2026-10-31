import type { ExecutionProgress } from '@mechane/sandbox-wire';
import { DateTime, Duration, Match, Option } from 'effect';
import { beginCheckpoint } from '../checkpoints/begin-checkpoint.ts';
import { GuestAnswer } from '../schemas.ts';
import type { DispatchedExecution, WorkspaceProviderStepInput } from '../types.ts';
import { endOutlived } from './end-outlived.ts';
import { executionProgress } from './execution-progress.ts';

/** A dispatched execution to ask its machine about, and the time by which the call answers that it still runs. */
type AskGuestInput = WorkspaceProviderStepInput & {
  readonly execution: DispatchedExecution;
  readonly deadline: DateTime.Utc;
};

type PutExecutionInput = Omit<AskGuestInput, 'store' | 'workspace'>;

/**
 * Asks only the machine the execution was sent to, which joins the run its first request started, and stores a settled
 * receipt once. A machine that stopped, or whose port reaches another machine's guest, ends with its unsettled
 * executions uncertain. So does one whose execution outlived its timeout and the grace.
 */
export async function askGuest({ store, provider, execution, deadline }: AskGuestInput): Promise<ExecutionProgress> {
  const { id: executionId, machineId } = execution;
  const answer = await putExecution({ provider, execution, deadline });
  const now = DateTime.nowUnsafe();

  await Match.valueTags(answer, {
    Settled: ({ receipt }) => beginCheckpoint({ store, executionId, machineId, receipt, now }),
    Unsettled: async () => await endOutlived({ store, provider, execution, now }),
    Lost: () => store.loseMachine({ machineId, now }),
  });

  // The claim wrote the execution's row, which nothing deletes.
  return executionProgress({ execution: Option.getOrThrow(store.execution({ executionId })) });
}

/** Sends the stored request again to the machine it was sent to while that machine runs, for the rest of the wait. */
async function putExecution({ provider, execution, deadline }: PutExecutionInput): Promise<GuestAnswer> {
  const guest = await provider.connect({ machineId: execution.machineId });

  if (Option.isNone(guest)) {
    return GuestAnswer.cases.Lost.make({});
  }

  const wait = Duration.max(DateTime.distance(DateTime.nowUnsafe(), deadline), Duration.zero);

  return await guest.value.execute({ execution, wait });
}
