import type { ErrorRecord, RunFailure, UsageInvalid } from '@mechane/cli-kernel';
import type { OperationFailed } from '@mechane/client';
import type { ExitStatus } from '@mechane/commands';

/** Every failure the CLI reports: a run's, or a command line's that does not decode. */
export type Failure = RunFailure | UsageInvalid;

/** A failure's report before a run's label begins its diagnostic: the exit status, the error record, and its text. */
export type FailureMessage = {
  readonly status: ExitStatus;
  readonly record: ErrorRecord;
  /** The diagnostic past the label: what failed and what to do next. */
  readonly text: string;
  /** Whether the run's label begins the diagnostic, as it does for each failure but a step on a private file. */
  readonly isLabelled: boolean;
};

/** The message of each failure of a union, under its tag; a tag without one fails to compile. */
export type FailureMessages<F extends Failure> = {
  readonly [T in F['_tag']]: (failure: Extract<F, Readonly<Record<'_tag', T>>>) => FailureMessage;
};

/** An error a deployment answered, by the fields its report reads: its family, its message and its failure. */
export type AnsweredFailure = Pick<OperationFailed, 'family' | 'message' | 'failure'>;
