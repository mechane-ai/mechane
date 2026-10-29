import { ReceiptStatus } from '@mechane/sandbox-wire';
import type { ExecutionId, ExecutionRequest, SettledReceipt } from '@mechane/sandbox-wire';
import { DateTime, Deferred, Duration, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import type { ExecutionUnstarted } from '../errors.ts';
import type { GuestSettings } from '../types.ts';
import { spawnBash } from './spawn-bash.ts';
import type { BashRun } from './types.ts';

/**
 * How long a settled execution waits for its pipes to close once its group is killed: only a process that left the
 * group can hold one open.
 */
const CLOSE_GRACE = Duration.seconds(1);

type RunExecutionInput = {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest;
  readonly settings: GuestSettings;
};

/** A bash that ran, and how it ended. */
type FinishedBash = {
  readonly run: BashRun;
  /** The code bash exited with, none when its timeout passed first. */
  readonly exitCode: Option.Option<number>;
};

/**
 * Runs bash text once in a process group of its own, from the machine's home with only the execution variables. It
 * settles the receipt once bash exits or its timeout passes, killing the group, also when the guest stops first. A
 * process that starts a session of its own runs on, holding the receipt at most the close grace.
 */
export const runExecution = Effect.fn('runExecution')(function* ({
  executionId,
  request,
  settings,
}: RunExecutionInput): Effect.fn.Return<SettledReceipt, ExecutionUnstarted> {
  const startedAt = DateTime.nowUnsafe();
  const { run, exitCode } = yield* finishedBash({ executionId, request, settings });

  yield* Deferred.await(run.closed).pipe(Effect.timeoutOption(CLOSE_GRACE));

  const output = run.output();
  const duration = DateTime.distance(startedAt, DateTime.nowUnsafe());

  return Option.match(exitCode, {
    onNone: (): SettledReceipt => ({ state: ReceiptStatus.TimedOut, duration, output }),
    onSome: (code): SettledReceipt => ({ state: ReceiptStatus.Exited, exitCode: code, duration, output }),
  });
});

/** Runs bash until it exits or its timeout passes; closing the scope kills its group, however the wait ends. */
const finishedBash = Effect.fn('finishedBash')(function* ({
  executionId,
  request,
  settings,
}: RunExecutionInput): Effect.fn.Return<FinishedBash, ExecutionUnstarted, Scope.Scope> {
  const run = yield* Effect.acquireRelease(spawnBash({ executionId, request, settings }), (bash) => bash.kill);
  const exitCode = yield* Deferred.await(run.exited).pipe(Effect.timeoutOption(request.timeout));

  return { run, exitCode };
}, Effect.scoped);
