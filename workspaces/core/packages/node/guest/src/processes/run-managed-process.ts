import { ProcessState } from '@mechane/sandbox-wire';
import type { ProcessStart } from '@mechane/sandbox-wire';
import { Deferred, Duration, Effect, MutableRef, Option } from 'effect';
import type { Scope } from 'effect';
import { redactExecutionOutput } from '../executions/redact-execution-output.ts';
import type { BashRun } from '../executions/types.ts';
import type { ExecutionLedger, GuestSettings } from '../types.ts';
import type { ProcessFailed } from './process-failed.ts';
import { spawnProcess } from './spawn-process.ts';
import type { ManagedProcess } from './types.ts';

const CLOSE_GRACE = Duration.seconds(1);

type RunManagedProcessInput = {
  readonly request: ProcessStart;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly managed: ManagedProcess;
  readonly onSettled: () => void;
};

type FinishedProcess = { readonly run: BashRun; readonly exitCode: number };

/** Owns a process group through leader exit and retains its final redacted output after cleanup. */
export const runManagedProcess = Effect.fn('runManagedProcess')(function* ({
  onSettled,
  ...input
}: RunManagedProcessInput): Effect.fn.Return<void> {
  const { managed } = input;

  yield* completeProcess(input).pipe(
    Effect.catchTags({
      ProcessFailed: () =>
        Effect.sync(() => {
          MutableRef.update(managed.state, (state) => ({ ...state, outcome: ProcessState.cases.Lost.make({}) }));
        }),
    }),
  );

  yield* Deferred.succeed(managed.ready, undefined);
  yield* Deferred.succeed(managed.settled, undefined);

  onSettled();
});

const completeProcess = Effect.fn('completeProcess')(function* (
  input: Omit<RunManagedProcessInput, 'onSettled'>,
): Effect.fn.Return<void, ProcessFailed> {
  const { managed } = input;
  const { run, exitCode } = yield* finishProcess(input);

  yield* Deferred.await(run.closed).pipe(Effect.timeoutOption(CLOSE_GRACE));

  const current = MutableRef.get(managed.state);
  const output = current.readOutput();
  const outcome = processOutcome({ isStopRequested: current.isStopRequested, exitCode });
  const runNone = Option.none<BashRun>();

  MutableRef.set(managed.state, { ...current, run: runNone, outcome, readOutput: () => output });
});

const finishProcess = Effect.fn('finishProcess')(function* ({
  request,
  settings,
  ledger,
  managed,
}: Omit<RunManagedProcessInput, 'onSettled'>): Effect.fn.Return<FinishedProcess, ProcessFailed, Scope.Scope> {
  const starting = startAdmittedProcess({ request, settings, ledger, managed });
  const run = yield* Effect.acquireRelease(starting, (child) => child.kill);

  yield* Deferred.succeed(managed.ready, undefined);

  const exitCode = yield* Deferred.await(run.exited);

  return { run, exitCode };
}, Effect.scoped);

const startAdmittedProcess = Effect.fn('startAdmittedProcess')(function* ({
  request,
  settings,
  ledger,
  managed,
}: Pick<RunManagedProcessInput, 'request' | 'settings' | 'ledger' | 'managed'>): Effect.fn.Return<
  BashRun,
  ProcessFailed,
  Scope.Scope
> {
  yield* Effect.acquireRelease(Effect.void, () => Effect.sync(ledger.finishProcessStart));

  const run = yield* spawnProcess({ request, settings });

  const readOutput: BashRun['output'] = () => {
    const output = run.output();

    return redactExecutionOutput({ output, request });
  };

  MutableRef.update(managed.state, (state) => ({ ...state, run: Option.some(run), readOutput }));

  return run;
}, Effect.scoped);

type ProcessOutcomeInput = { readonly isStopRequested: boolean; readonly exitCode: number };

function processOutcome({ isStopRequested, exitCode }: ProcessOutcomeInput): ProcessState {
  if (isStopRequested) {
    return ProcessState.cases.Stopped.make({});
  }

  return ProcessState.cases.Exited.make({ exitCode });
}
