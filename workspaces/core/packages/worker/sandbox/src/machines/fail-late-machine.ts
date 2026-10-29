import type { LiveMachineRow } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';

/** How long a starting machine has to answer its health, a cold start's image pull included, before it fails. */
const MACHINE_STARTUP = Duration.seconds(90);

/** A starting machine, and when it started, from which its startup deadline counts. */
type FailLateMachineInput = ProviderStepInput & MachineIdInput & Pick<LiveMachineRow, 'startedAt'>;

/**
 * Stops and fails a starting machine past its startup deadline, the stop first. Each execution claimed by the deadline
 * becomes unavailable.
 */
export async function failLateMachine({ store, provider, machineId, startedAt }: FailLateMachineInput): Promise<void> {
  const restoration = store.workspace().restoration;

  const startupDeadline: DateTime.Utc = (() => {
    if (Option.isSome(restoration) && restoration.value.machineId === machineId) {
      return DateTime.addDuration(restoration.value.startedAt, WORKSPACE_OPERATION_TIMEOUT);
    }

    return DateTime.addDuration(startedAt, MACHINE_STARTUP);
  })();

  if (DateTime.isLessThanOrEqualTo(DateTime.nowUnsafe(), startupDeadline)) {
    return;
  }

  await provider.stop({ machineId });
  store.failMachine({ machineId, startupDeadline, now: DateTime.nowUnsafe() });
}
