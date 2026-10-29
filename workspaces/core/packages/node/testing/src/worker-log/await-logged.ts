import type { LogLine } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Duration, Effect, Schedule } from 'effect';
import { readFile } from 'node:fs/promises';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { WorkerLog } from './types.ts';
import { workerLines } from './worker-lines.ts';

/** The Worker's lines a wait reads. */
type LoggedInput = { readonly lines: ReadonlyArray<LogLine> };

/** How often a scenario reads the stack's log for a line it waits on, and how long it waits at most. */
const LOG_POLL_INTERVAL = Duration.millis(100);

const LOG_WAIT_TIMEOUT = Duration.seconds(20);

/** A wait for the Worker's lines: what it waits for, as its failure names it, and when it holds. */
type AwaitLoggedInput = {
  readonly stack: Stack;
  readonly awaited: string;
  readonly isLogged: (input: LoggedInput) => boolean;
};

/** Reads the stack's log each poll interval until `isLogged` holds of its Worker's lines, and fails once it is late. */
export const awaitLogged = Effect.fn('awaitLogged')(function* ({
  stack,
  isLogged,
  awaited,
}: AwaitLoggedInput): Effect.fn.Return<WorkerLog, FileStepFailed> {
  const late = new FileStepFailed({
    step: FileStep.Await,
    path: stack.logFile,
    reason: `the Worker logged no ${awaited} within ${Duration.format(LOG_WAIT_TIMEOUT)}`,
  });

  return yield* loggedOnce({ stack, isLogged, awaited }).pipe(
    Effect.retry({ schedule: Schedule.spaced(LOG_POLL_INTERVAL) }),
    Effect.timeoutOrElse({ duration: LOG_WAIT_TIMEOUT, orElse: () => Effect.fail(late) }),
  );
});

/** Reads the Worker's lines once, and fails while `isLogged` does not hold of them. */
const loggedOnce = Effect.fn('loggedOnce')(function* ({
  stack,
  isLogged,
  awaited,
}: AwaitLoggedInput): Effect.fn.Return<WorkerLog, FileStepFailed> {
  const path = stack.logFile;

  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
  });

  const log = workerLines({ text });

  if (!isLogged({ lines: log.lines })) {
    return yield* new FileStepFailed({ step: FileStep.Await, path, reason: `the Worker has not logged ${awaited}` });
  }

  return log;
});
