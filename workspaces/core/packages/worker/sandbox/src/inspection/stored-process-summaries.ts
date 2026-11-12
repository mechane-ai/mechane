import type { SandboxStore } from '@mechane/sandbox-store';
import type { ProcessSummaries } from '@mechane/sandbox-wire';
import { ProcessState } from '@mechane/sandbox-wire';
import { Option } from 'effect';

type StoredProcessSummariesInput = {
  readonly store: Pick<SandboxStore, 'runningProcesses' | 'recentTerminalProcesses'>;
};

/** Passive inspection reads the last recorded observations without contacting or renewing the guest. */
export function storedProcessSummaries({ store }: StoredProcessSummariesInput): ProcessSummaries {
  const running = store.runningProcesses().flatMap((record) => {
    const observation = record.observation;

    if (Option.isNone(observation) || !ProcessState.guards.Running(observation.value.state)) {
      return [];
    }

    return [{ handle: observation.value.handle, state: observation.value.state }];
  });

  const recent = store.recentTerminalProcesses();

  const finished = recent.flatMap((record) => {
    const summary = Option.map(record.observation, ({ handle, state }) => ({ handle, state }));

    return Option.toArray(summary);
  });

  return [...running, ...finished];
}
