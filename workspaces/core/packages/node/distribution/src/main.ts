import { finish, reportExit, stepLine, writeResult } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import type { DistributionFailed } from './errors.ts';
import { runDistribution } from './run-distribution.ts';
import type { DistributionResult } from './types.ts';

const FAILURE_LINES: Readonly<FailureLines<DistributionFailed>> = { DistributionFailed: stepLine };

type ResultInput = { readonly value: DistributionResult };

async function main(): Promise<void> {
  const operation = runDistribution();
  const exit = await Effect.runPromiseExit(operation);

  const succeeded: (input: ResultInput) => number = ({ value }) => {
    const line = JSON.stringify(value);

    writeResult({ line });

    return 0;
  };

  const status = reportExit({
    exit,
    program: 'distribution',
    operation: 'build or verify installation artifacts',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded,
    failed: 1,
  });

  finish({ status });
}

await main();
