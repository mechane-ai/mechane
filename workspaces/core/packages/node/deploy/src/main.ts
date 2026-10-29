import { PROGRAM } from '@mechane/deploy-kernel';
import type { DeployFailed } from '@mechane/deploy-kernel';
import { finish, reportExit, stepLine } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { runDeploy } from './run-deploy.ts';

/** How the deploy program ends: its mode finished, or a step or a check of it failed. */
const DeployStatus = { Done: 0, Failed: 1 } as const;

/** What the failed step or check of a run could not do, and why. */
const FAILURE_LINES: Readonly<FailureLines<DeployFailed>> = { DeployFailed: stepLine };

/**
 * Runs the deploy program's mode: it uploads the CLI's built release, renders production's configuration, or from a
 * clean checkout checks, deploys, rolls back or drives production. A stop signal fails the run.
 */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runDeploy());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'run the deploy program',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => DeployStatus.Done,
    failed: DeployStatus.Failed,
  });

  finish({ status });
}

await main();
