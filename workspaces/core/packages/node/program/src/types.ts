import type { Duration, Effect, Option } from 'effect';
import type { ProcessFailed } from './errors.ts';
import type { Lock, StepSubject } from './schemas.ts';

/** A lock as an earlier revision or the commit holds it, and the lock to compare it with. */
export type LockPair = { readonly locked: Lock; readonly current: Lock };

/**
 * The step that failed, a member of the program's own closed set of steps, what it acted on, and why: what builds its
 * failure.
 */
export type StepFailure<S> = {
  readonly step: S;
  readonly subjects: ReadonlyArray<StepSubject>;
  readonly reason: string;
};

/** A program's failure, built from the step that failed and why, such as the stack's `StackFailed`. */
export type StepFailureClass<S, E> = new (failure: StepFailure<S>) => E;

/** A failure of a run, which the program's message table words. */
export type DescribeInput<E> = { readonly failure: E };

/** A program's message table: the diagnostic line of each failure of its run, by the failure's tag. */
export type FailureLines<E extends Readonly<Record<'_tag', string>>> = {
  readonly [Tag in E['_tag']]: (failure: Extract<E, Readonly<Record<'_tag', Tag>>>) => string;
};

/** A command to start with its arguments, the only environment it gets, and how long it may run. */
export type StartProcessInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Readonly<Record<string, string>>;
  /** How long the child may run before its exit fails; closing the caller's scope kills it. */
  readonly timeout: Duration.Duration;
};

/** How a child process ended and what it wrote. */
export type ProcessRun = {
  /** The status the process exited with, none when a signal ended it. */
  readonly status: Option.Option<number>;
  readonly stdout: string;
  readonly stderr: string;
};

/** A child that runs: what it has written to each stream so far, and how it ends. */
export type RunningProcess = {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly exited: Effect.Effect<ProcessRun, ProcessFailed>;
};
