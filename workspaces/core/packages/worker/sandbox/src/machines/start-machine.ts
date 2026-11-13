import type { LiveMachineRow } from '@mechane/sandbox-store';
import { StartupFailure, StartupPhase } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Duration, Option, Result } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { writeRestoreStageTiming } from '../output/write-sandbox-diagnostic.ts';
import type { ProviderStepInput } from '../types.ts';

type StartMachineInput = ProviderStepInput & { readonly machine: LiveMachineRow };

/** One startup budget covers the same physical machine through bootstrap, restore and reattachment. */
export async function startMachine({ store, provider, machine }: StartMachineInput): Promise<void> {
  const timeout = provider.startupTimeout();
  const bootDeadline = DateTime.addDuration(machine.startedAt, timeout);
  const deadlineAt = DateTime.addDuration(bootDeadline, WORKSPACE_OPERATION_TIMEOUT);

  store.beginStartup({ machineId: machine.id, deadlineAt, now: machine.startedAt });

  const latest = store.latestStartup();
  const current = Option.filter(latest, (value) => value.machineId === machine.id);

  const phase = Option.match(current, {
    onNone: () => StartupPhase.Container,
    onSome: (value) => value.progress.phase,
  });

  const startedAt = DateTime.nowUnsafe();
  const started = performance.now();
  const state = store.workspace();
  const checkpoint = state.head;
  const promise = provider.start({ machineId: machine.id, checkpoint });
  const result = await capturePromise({ promise });
  const finished = performance.now();
  const milliseconds = finished - started;
  const now = DateTime.nowUnsafe();

  const head = store.workspace().head;

  if (phase === StartupPhase.Transfer && Option.isSome(head)) {
    const elapsed = Duration.millis(milliseconds);

    writeRestoreStageTiming({
      stage: 'provider',
      machineId: machine.id,
      generation: head.value.generation,
      startedAt,
      elapsed,
    });
  }

  store.recordStartupWork({ machineId: machine.id, phase, milliseconds });

  if (Result.isFailure(result)) {
    store.failStartup({ machineId: machine.id, failure: StartupFailure.Provider, now });
  }

  Result.getOrThrow(result);

  const startup = store.latestStartup();

  if (
    Option.exists(startup, (value) => value.machineId === machine.id && value.progress.phase === StartupPhase.Container)
  ) {
    store.advanceStartup({ machineId: machine.id, phase: StartupPhase.Bootstrap, now });
  }
}
