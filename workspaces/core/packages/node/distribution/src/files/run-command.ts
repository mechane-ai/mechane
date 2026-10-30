import { finishedProcess } from '@mechane/program';
import { Duration, Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { DistributionSettings } from '../types.ts';

const COMMAND_TIMEOUT = Duration.minutes(30);

type CommandInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly settings: DistributionSettings;
};

/** Runs a bounded build command with only the publisher settings inherited by its child. */
export const runCommand = Effect.fn('runCommand')(function* ({
  command,
  args,
  settings,
}: CommandInput): Effect.fn.Return<string, DistributionFailed> {
  const run = yield* finishedProcess({ command, args, environment: settings.inherited, timeout: COMMAND_TIMEOUT }).pipe(
    Effect.mapError(({ reason }) => new DistributionFailed({ step: DistributionStep.Command, reason })),
  );

  return run.stdout;
});
