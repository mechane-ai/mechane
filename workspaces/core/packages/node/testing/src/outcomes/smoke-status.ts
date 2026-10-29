import { reportExit, writeDiagnostic } from '@mechane/program';
import type { StackFailed } from '@mechane/stack';
import { Option } from 'effect';
import type { Exit } from 'effect';
import type { ScenariosFailed } from '../errors.ts';
import { SMOKE_PROGRAM } from './constants.ts';
import { smokeFailureMessage } from './smoke-failure-message.ts';

/** How the smoke ends: every scenario passed, or the stack, a scenario or a stop signal ended it first. */
const SmokeStatus = { Passed: 0, Failed: 1 } as const;

type SmokeStatus = (typeof SmokeStatus)[keyof typeof SmokeStatus];

type SmokeStatusInput = {
  /** How the smoke ran, none when a stop signal ended it before the scenarios settled. */
  readonly exit: Exit.Exit<Option.Option<void>, ScenariosFailed | StackFailed>;
};

type SettledStatusInput = {
  /** None when a stop signal ended the smoke before its scenarios settled. */
  readonly settled: Option.Option<void>;
};

/** The status the smoke ends with, after writing what ended it when that was not every scenario passing. */
export function smokeStatus({ exit }: SmokeStatusInput): SmokeStatus {
  return reportExit({
    exit,
    program: SMOKE_PROGRAM,
    operation: 'run the smoke',
    describe: smokeFailureMessage,
    succeeded: ({ value }) => settledStatus({ settled: value }),
    failed: SmokeStatus.Failed,
  });
}

/** Passed once every scenario settled, and failed after saying so when a stop signal ended the smoke first. */
function settledStatus({ settled }: SettledStatusInput): SmokeStatus {
  if (Option.isSome(settled)) {
    return SmokeStatus.Passed;
  }

  writeDiagnostic({ program: SMOKE_PROGRAM, line: 'a stop signal ended the smoke before its scenarios settled' });

  return SmokeStatus.Failed;
}
