import { ExecutionStatus } from '@mechane/sandbox-store';
import type { ExecutionId } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import type { ProviderStepInput } from '../types.ts';

type CancelSandboxExecutionInput = ProviderStepInput & { readonly executionId: ExecutionId };

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
  await provider.stop({ machineId: execution.machineId });
}
