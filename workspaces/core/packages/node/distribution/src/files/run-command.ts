import { finishedProcess, writeDiagnostic } from '@mechane/program';
import { Duration, Effect } from 'effect';
import { homedir, tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DistributionMode, DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { DistributionSettings } from '../types.ts';

const COMMAND_TIMEOUT = Duration.minutes(30);
const LIVE_MODES: ReadonlySet<DistributionMode> = new Set([DistributionMode.Candidate, DistributionMode.Accept]);

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
  const run = yield* finishedProcess({
    command,
    args,
    environment: settings.inherited,
    timeout: COMMAND_TIMEOUT,
    onOutput: ({ contents }) => {
      if (!LIVE_MODES.has(settings.mode)) {
        return;
      }

      const line = contents
        .replaceAll(resolve(SOURCE_FOLDER), '/source')
        .replaceAll(homedir(), '/operator-home')
        .replaceAll(resolve(tmpdir()), '/tmp')
        .trimEnd();

      if (line.length > 0) {
        writeDiagnostic({ program: 'distribution', line });
      }
    },
  }).pipe(Effect.mapError(({ reason }) => new DistributionFailed({ step: DistributionStep.Command, reason })));

  return run.stdout;
});
