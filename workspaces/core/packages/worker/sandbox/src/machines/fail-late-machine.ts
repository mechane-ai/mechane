import type { LiveMachineRow } from '@mechane/sandbox-store';
import { StartupFailure, StartupPhase } from '@mechane/sandbox-wire';
import type { MachineStartup } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';

type FailLateMachineInput = ProviderStepInput & MachineIdInput & Pick<LiveMachineRow, 'startedAt'>;
const BOOTSTRAP_PHASES: ReadonlySet<StartupPhase> = new Set([StartupPhase.Container, StartupPhase.Bootstrap]);

/** An expired start never dispatches its pending command or resets its deadline on a later observation. */
export async function failLateMachine({ store, provider, machineId, startedAt }: FailLateMachineInput): Promise<void> {
  const timeout = provider.startupTimeout();
  const bootDeadline = DateTime.addDuration(startedAt, timeout);
  const latest = store.latestStartup();
  const stored = Option.filter(latest, (value) => value.machineId === machineId);

  const startupDeadline = Option.match(stored, {
    onNone: () => bootDeadline,
    onSome: (startup) => phaseDeadline({ startup }),
  });

  const now = DateTime.nowUnsafe();

  if (DateTime.isLessThanOrEqualTo(now, startupDeadline)) {
    return;
  }

  store.failStartup({ machineId, failure: StartupFailure.Deadline, now });

  const cacheCheckpoint = Option.none();

  await provider.stop({ machineId, checkpoint: cacheCheckpoint });

  const stoppedAt = DateTime.nowUnsafe();

  store.failMachine({ machineId, startupDeadline, now: stoppedAt });
}

type PhaseDeadlineInput = { readonly startup: MachineStartup };

function phaseDeadline({ startup }: PhaseDeadlineInput): DateTime.Utc {
  if (BOOTSTRAP_PHASES.has(startup.progress.phase)) {
    return DateTime.subtractDuration(startup.deadlineAt, WORKSPACE_OPERATION_TIMEOUT);
  }

  const recorded = startup.progress.steps.find((step) => step.phase === StartupPhase.Transfer);
  const transfer = Option.fromUndefinedOr(recorded);

  if (Option.isNone(transfer)) {
    return startup.deadlineAt;
  }

  const restoreDeadline = DateTime.addDuration(transfer.value.startedAt, WORKSPACE_OPERATION_TIMEOUT);

  return DateTime.min(restoreDeadline, startup.deadlineAt);
}
