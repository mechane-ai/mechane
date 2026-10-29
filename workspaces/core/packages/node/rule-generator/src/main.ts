import { finish, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { GenerateStatus } from './constants.ts';
import type { GenerateFailed } from './errors.ts';
import { reportOutcome } from './report-outcome.ts';
import { runRules } from './run-rules.ts';

/** The generator's name, which prefixes each diagnostic it writes. */
const PROGRAM = 'rules';

/** The step the generator's failure could not take on its file, and why. */
const FAILURE_LINES: Readonly<FailureLines<GenerateFailed>> = {
  GenerateFailed: ({ step, path, reason }) => `${step} ${path}: ${reason}`,
};

/**
 * Writes every file the registry generates, or with `check` lists each that differs; or answers a question about the
 * registry. Then it ends with the run's status.
 */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runRules());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: "generate the rules' files",
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: ({ value }) => reportOutcome({ outcome: value }),
    failed: GenerateStatus.Failed,
  });

  finish({ status });
}

await main();
