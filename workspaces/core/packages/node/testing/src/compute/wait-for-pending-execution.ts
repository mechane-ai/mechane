import { Option } from 'effect';
import { readEnvironment } from '../mechs.ts';
import type { MechContext } from '../types.ts';
import { waitFor } from '../wait-for.ts';

type PendingExecutionInput = MechContext & { readonly excludeExecutionId: string; readonly timeoutMs: number };

export async function waitForPendingExecution(input: PendingExecutionInput): Promise<string> {
  const pending = await waitFor({
    name: 'a claimed command to remain undispatched',
    read: async () => {
      const report = await readEnvironment({ ...input, signal: AbortSignal.timeout(input.timeoutMs) });

      return report.environment.execution;
    },
    accept: (execution) =>
      Option.exists(
        execution,
        (value) => value.executionId !== input.excludeExecutionId && Option.isNone(value.dispatchedAt),
      ),
    timeoutMs: input.timeoutMs,
  });

  return Option.getOrThrow(pending).executionId;
}
