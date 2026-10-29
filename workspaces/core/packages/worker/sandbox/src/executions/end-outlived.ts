import type { SandboxStore } from '@mechane/sandbox-store';
import { DateTime, Duration } from 'effect';
import type { DispatchedExecution, MachineProvider } from '../types.ts';

/**
 * How long past its own timeout an execution may stay unsettled before its machine counts as broken. Its guest would
 * have ended it by then, so this is the one deadline of an execution's whole life.
 */
const EXECUTION_GRACE = Duration.seconds(30);

/** An unsettled dispatched execution, and the instant its guest left it unsettled. */
type EndOutlivedInput = {
  readonly store: SandboxStore;
  readonly provider: MachineProvider;
  readonly execution: DispatchedExecution;
  readonly now: DateTime.Utc;
};

/**
 * Stops and ends the machine of an execution past its timeout and the grace, still running or unreachable. Its guest
 * would have ended the execution by then, so no call waits on a broken guest forever.
 */
export async function endOutlived({ store, provider, execution, now }: EndOutlivedInput): Promise<void> {
  const { machineId, dispatchedAt, timeout } = execution;
  const outlivedAt = DateTime.addDuration(dispatchedAt, Duration.sum(timeout, EXECUTION_GRACE));

  if (DateTime.isLessThanOrEqualTo(now, outlivedAt)) {
    return;
  }

  await provider.stop({ machineId });
  store.loseMachine({ machineId, now: DateTime.nowUnsafe() });
}
