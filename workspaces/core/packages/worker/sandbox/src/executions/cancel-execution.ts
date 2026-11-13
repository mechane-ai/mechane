import { ExecutionStatus } from '@mechane/sandbox-store';
import { ExecutionProgress, SandboxExecutionRefusal } from '@mechane/sandbox-wire';
import type { ExecutionId, SandboxExecutionResult } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import type { ProviderStepInput } from '../types.ts';
import { executionProgress } from './execution-progress.ts';

type CancelSandboxExecutionInput = ProviderStepInput & { readonly executionId: ExecutionId };

/** Refuses only work that has not dispatched; a racing dispatch retains its original receipt and machine. */
export function cancelPendingExecution({
  store,
  executionId,
}: Pick<CancelSandboxExecutionInput, 'store' | 'executionId'>): SandboxExecutionResult {
  return store.atomic({
    run: () => {
      const found = store.execution({ executionId });

      if (Option.isNone(found)) {
        return SandboxExecutionRefusal.cases.ExecutionNotFound.make({});
      }

      if (found.value.status === ExecutionStatus.Pending) {
        store.cancelPendingExecution({ executionId });

        return ExecutionProgress.cases.Unavailable.make({});
      }

      return executionProgress({ execution: found.value });
    },
  });
}

/** Cancellation bypasses the request queue so the command's own wait cannot delay termination. */
export async function cancelExecution({ store, provider, executionId }: CancelSandboxExecutionInput): Promise<void> {
  store.cancelPendingExecution({ executionId });

  const found = store.execution({ executionId });

  if (Option.isNone(found)) {
    return;
  }

  const execution = found.value;

  if (execution.status !== ExecutionStatus.Dispatched) {
    return;
  }

  const checkpoint = store.workspace().checkpoint;

  const cancel: () => void = () => {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId: execution.machineId, now });

    if (Option.isSome(checkpoint) && checkpoint.value.machineId === execution.machineId) {
      store.retireWorkspace({ generation: checkpoint.value.generation });
    }
  };

  store.atomic({ run: cancel });

  const cacheCheckpoint = Option.none();

  await provider.stop({ machineId: execution.machineId, checkpoint: cacheCheckpoint });
}
