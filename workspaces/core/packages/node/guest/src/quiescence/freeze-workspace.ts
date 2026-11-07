import { GuestScope, WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Duration, Effect, Option, Result, Schema } from 'effect';
import type { Scope } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import { ProcessDisappeared } from './container-process.schemas.ts';
import type { FreezeInput, FreezeLease, FreezeProcess } from './freeze.types.ts';
import { readContainerProcess } from './read-container-process.ts';
import { readFreezeProcesses } from './read-freeze-processes.ts';

const FREEZE_TIMEOUT = Duration.seconds(3);
const FREEZE_POLL = Duration.millis(25);
const ProcessSignal = { Stop: 'SIGSTOP', Continue: 'SIGCONT' } as const;

type FreezeRuntime = FreezeInput & { readonly remember: (candidate: FreezeProcess) => void };

/** A lease records identities before signaling, so a failed scan still resumes every process it stopped. */
export const freezeWorkspace = Effect.fn('freezeWorkspace')(function* (
  input: FreezeInput,
): Effect.fn.Return<FreezeLease, WorkspaceFailed, Scope.Scope> {
  const stopped = new Map<number, FreezeProcess>();
  const state = { isRetained: false };

  const remember: FreezeRuntime['remember'] = (candidate) => {
    stopped.set(candidate.processId, candidate);
  };

  const resume = Effect.fn('resume')(function* (): Effect.fn.Return<void, WorkspaceFailed> {
    const current = yield* readFreezeProcesses(input);
    const candidates = [...stopped.values()];

    yield* Effect.forEach(candidates, (candidate) => continueProcess({ ...input, candidate, current }), {
      concurrency: 1,
      discard: true,
    });

    stopped.clear();
  });

  const release = Effect.fn('release')(function* (): Effect.fn.Return<void, WorkspaceFailed> {
    if (!state.isRetained) {
      yield* resume();
    }
  });

  const releasing = release();

  yield* Effect.acquireRelease(Effect.void, () => Effect.orDie(releasing));
  yield* stopWorkspaceProcesses({ ...input, remember });

  return {
    retain: () => {
      state.isRetained = true;
    },
    resume: resume(),
  };
});

const stopWorkspaceProcesses = Effect.fn('stopWorkspaceProcesses')(function* (
  input: FreezeRuntime,
): Effect.fn.Return<void, WorkspaceFailed> {
  const started = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(started, FREEZE_TIMEOUT);

  for (let previous = Option.none<string>(); isBeforeDeadline({ deadline });) {
    const processes = yield* readFreezeProcesses(input);
    const identity = processes.map(freezeProcessKey).toSorted().join('\n');

    const isStopped = processes.every(
      (candidate) => candidate.state.startsWith('T') || candidate.state.startsWith('t'),
    );

    if (isStopped && Option.contains(previous, identity)) {
      return;
    }

    yield* Effect.forEach(processes, (candidate) => stopProcess({ ...input, candidate }), {
      concurrency: 1,
      discard: true,
    });
    yield* Effect.sleep(FREEZE_POLL);

    previous = Option.some(identity);
  }

  return yield* new WorkspaceFailed({
    generation: input.generation,
    step: WorkspaceStep.Archive,
    reason: 'workspace processes did not pause before checkpoint',
  });
});

type StopProcessInput = FreezeRuntime & { readonly candidate: FreezeProcess };

const stopProcess = Effect.fn('stopProcess')(function* ({
  candidate,
  remember,
  ...input
}: StopProcessInput): Effect.fn.Return<void, WorkspaceFailed> {
  const current = yield* currentProcess({ ...input, candidate });

  if (Option.isNone(current) || current.value.state.startsWith('T') || current.value.state.startsWith('t')) {
    return;
  }

  remember(current.value);
  yield* signalProcess({ ...input, candidate: current.value, signal: ProcessSignal.Stop });
});

type CurrentProcessInput = FreezeInput & { readonly candidate: FreezeProcess };

const currentProcess = Effect.fn('currentProcess')(function* ({
  candidate,
  ...input
}: CurrentProcessInput): Effect.fn.Return<Option.Option<FreezeProcess>, WorkspaceFailed> {
  if (input.settings.scope === GuestScope.Process) {
    return Option.some(candidate);
  }

  const directory = String(candidate.processId);
  const process = yield* readContainerProcess({ generation: input.generation, directory });

  if (Option.isNone(process) || process.value.startedAt !== candidate.startedAt) {
    return Option.none();
  }

  return Option.some({ ...candidate, state: process.value.State });
});

type ContinueProcessInput = CurrentProcessInput & { readonly current: ReadonlyArray<FreezeProcess> };

const continueProcess = Effect.fn('continueProcess')(function* ({
  candidate,
  current,
  ...input
}: ContinueProcessInput): Effect.fn.Return<void, WorkspaceFailed> {
  const found = current.find(
    (process) =>
      process.processId === candidate.processId &&
      process.groupId === candidate.groupId &&
      process.startedAt === candidate.startedAt,
  );

  const matched = Option.fromNullishOr(found);

  if (Option.isNone(matched)) {
    return;
  }

  const identified = yield* currentProcess({ ...input, candidate: matched.value });

  if (Option.isSome(identified)) {
    yield* signalProcess({ ...input, candidate: identified.value, signal: ProcessSignal.Continue });
  }
});

type SignalProcessInput = CurrentProcessInput & { readonly signal: (typeof ProcessSignal)[keyof typeof ProcessSignal] };

const signalProcess = Effect.fn('signalProcess')(function* ({
  generation,
  candidate,
  signal,
}: SignalProcessInput): Effect.fn.Return<void, WorkspaceFailed> {
  const sent = Result.try(() => process.kill(candidate.processId, signal));

  if (Result.isSuccess(sent)) {
    return;
  }

  const disappeared = Schema.decodeUnknownResult(ProcessDisappeared)(sent.failure);

  if (Result.isFailure(disappeared)) {
    const reason = String(sent.failure);

    return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });
  }
});

type DeadlineInput = { readonly deadline: DateTime.Utc };

function isBeforeDeadline({ deadline }: DeadlineInput): boolean {
  const now = DateTime.nowUnsafe();

  return DateTime.isLessThan(now, deadline);
}

function freezeProcessKey({ processId, startedAt }: FreezeProcess): string {
  return `${processId}:${startedAt}`;
}
