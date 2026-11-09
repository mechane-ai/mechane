import { MachineId } from '@mechane/records';
import { MachineStatus } from '@mechane/sandbox-store';
import { ProcessState } from '@mechane/sandbox-wire';
import type { ProcessSummaries, ProcessSummary } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { connectLiveMachine } from '../machines/connect-live-machine.ts';
import type { ProviderStepInput } from '../types.ts';
import { listGuestProcesses } from './list-guest-processes.ts';
import { observeManagedProcess } from './managed-processes.ts';

/** Lists every live process and bounded terminal history, without transferring log output to passive callers. */
export async function listManagedProcesses({ store, provider }: ProviderStepInput): Promise<ProcessSummaries> {
  const input = { store, provider };
  const current = await currentProcesses(input);
  const pending = current.map((summary) => reconcileProcess({ ...input, summary }));
  const reconciled = await Promise.all(pending);

  await reconcileMissingProcesses({ ...input, current });

  const running = reconciled.flatMap(Option.toArray).filter((summary) => {
    const recorded = store.process({ processId: summary.handle.processId });

    if (Option.isNone(recorded) || !Option.contains(recorded.value.machineId, summary.handle.machineId)) {
      return false;
    }

    const observation = recorded.value.observation;

    return Option.isNone(observation) || ProcessState.guards.Running(observation.value.state);
  });

  const recent = store.recentTerminalProcesses();

  const finished = recent.flatMap(({ observation }) => {
    const summary = Option.map(observation, ({ handle, state }) => ({ handle, state }));

    return Option.toArray(summary);
  });

  return [...running, ...finished];
}

type MissingProcessesInput = ProviderStepInput & { readonly current: ProcessSummaries };

async function reconcileMissingProcesses({ store, provider, current }: MissingProcessesInput): Promise<void> {
  const reportedIds = current.map(({ handle }) => handle.processId);
  const reported = new Set(reportedIds);

  for (const record of store.processes()) {
    const observation = record.observation;
    const wasRunning = Option.isSome(observation) && ProcessState.guards.Running(observation.value.state);

    if (wasRunning && Option.isSome(record.machineId) && !reported.has(record.processId)) {
      await observeManagedProcess({
        store,
        provider,
        handle: { processId: record.processId, machineId: record.machineId.value },
        shouldStop: false,
      });
    }
  }
}

async function currentProcesses({ store, provider }: ProviderStepInput): Promise<ProcessSummaries> {
  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.status === MachineStatus.Starting) {
    return [];
  }

  const decoded = Schema.decodeUnknownResult(MachineId)(live.value.id);
  const machineId = Result.getOrThrow(decoded);
  const guest = await connectLiveMachine({ store, provider, machineId });

  if (Option.isNone(guest)) {
    return [];
  }

  return await listGuestProcesses({ guest: guest.value, machineId });
}

type ReconcileProcessInput = ProviderStepInput & { readonly summary: ProcessSummary };

async function reconcileProcess({
  store,
  provider,
  summary,
}: ReconcileProcessInput): Promise<Option.Option<ProcessSummary>> {
  const record = store.process({ processId: summary.handle.processId });

  if (Option.isNone(record) || !Option.contains(record.value.machineId, summary.handle.machineId)) {
    return Option.none();
  }

  const previous = record.value.observation;

  if (Option.isSome(previous) && !ProcessState.guards.Running(previous.value.state)) {
    return Option.none();
  }

  if (ProcessState.guards.Running(summary.state)) {
    return Option.some(summary);
  }

  await observeManagedProcess({ store, provider, handle: summary.handle, shouldStop: false });

  return Option.none();
}
