import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreMachineWorkspace } from '../workspace/restore-machine-workspace.ts';

/** How often a call asks a starting machine's guest for its health. */
const HEALTH_INTERVAL = Duration.millis(500);

/**
 * What one ask of a starting machine's guest found: health, no health with time to ask again, or none before the
 * deadline.
 */
const HealthAnswer = { Healthy: 'healthy', Retry: 'retry', Late: 'late' } as const;

type HealthAnswer = (typeof HealthAnswer)[keyof typeof HealthAnswer];

/** A machine whose health to wait for, and the time by which the call answers that its execution still runs. */
type AwaitHealthInput = WorkspaceProviderStepInput & MachineIdInput & { readonly deadline: DateTime.Utc };

type HealthAnswerInput = Omit<AwaitHealthInput, 'store' | 'workspace'>;

/**
 * Asks the machine's guest for its health every interval until it answers, which makes the machine ready, or until the
 * next ask would pass the call's deadline. Answers whether the machine became ready.
 */
export async function awaitHealth({
  store,
  provider,
  workspace,
  machineId,
  deadline,
}: AwaitHealthInput): Promise<boolean> {
  let answer = await healthAnswer({ provider, machineId, deadline });

  while (answer === HealthAnswer.Retry) {
    await waitFor({ span: HEALTH_INTERVAL });

    answer = await healthAnswer({ provider, machineId, deadline });
  }

  if (answer === HealthAnswer.Late) {
    return false;
  }

  const isRestored = await restoreMachineWorkspace({ store, provider, workspace, machineId });

  if (!isRestored) {
    return false;
  }

  store.readyMachine({ machineId, now: DateTime.nowUnsafe() });

  return true;
}

/** Asks the guest for its health once, and whether another ask fits before the deadline when it has none. */
async function healthAnswer({ provider, machineId, deadline }: HealthAnswerInput): Promise<HealthAnswer> {
  const guest = await provider.connect({ machineId });

  // A guest that does not listen yet refuses the connection, which is not health.
  const isHealthy = Option.isSome(guest) && (await guest.value.health({ machineId }));

  if (isHealthy) {
    return HealthAnswer.Healthy;
  }

  if (DateTime.isGreaterThanOrEqualTo(DateTime.addDuration(DateTime.nowUnsafe(), HEALTH_INTERVAL), deadline)) {
    return HealthAnswer.Late;
  }

  return HealthAnswer.Retry;
}
