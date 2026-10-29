import type { RecordId } from '@mechane/records';
import { GuestScope, WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Duration, Effect, Result, Schema } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import type { ContainerProcess } from './container-process.schemas.ts';
import { ProcessDisappeared } from './container-process.schemas.ts';
import { liveContainerProcesses } from './live-container-processes.ts';

const QUIESCE_TIMEOUT = Duration.seconds(3);
const QUIESCE_POLL = Duration.millis(50);

/** Container checkpoints end escaped command sessions too. Host fixtures explicitly own only their process groups. */
export const quiesceWorkspace = Effect.fn('quiesceWorkspace')(function* (
  input: WorkspaceFilesInput,
): Effect.fn.Return<void, WorkspaceFailed> {
  const { generation, settings } = input;

  if (settings.scope === GuestScope.Process) {
    return;
  }

  const started = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(started, QUIESCE_TIMEOUT);

  for (
    let processes = yield* liveContainerProcesses(input);
    processes.length > 0;
    processes = yield* liveContainerProcesses(input)
  ) {
    const now = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return yield* new WorkspaceFailed({
        generation,
        step: WorkspaceStep.Archive,
        reason: 'container command processes did not stop before checkpoint',
      });
    }

    const stop: (candidate: ContainerProcess) => Effect.Effect<void, WorkspaceFailed> = (candidate) =>
      killContainerProcess({ generation, candidate });

    yield* Effect.forEach(processes, stop, { concurrency: 1, discard: true });

    yield* Effect.sleep(QUIESCE_POLL);
  }
});

type KillContainerProcessInput = { readonly generation: RecordId; readonly candidate: ContainerProcess };

const killContainerProcess = Effect.fn('killContainerProcess')(function* ({
  generation,
  candidate,
}: KillContainerProcessInput): Effect.fn.Return<void, WorkspaceFailed> {
  const killed = Result.try(() => process.kill(candidate.Pid, 'SIGKILL'));

  if (Result.isFailure(killed) && !Schema.is(ProcessDisappeared)(killed.failure)) {
    const reason = String(killed.failure);

    return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });
  }
});
