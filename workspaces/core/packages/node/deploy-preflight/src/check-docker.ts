import { DeployFailed, DeployStep, WRANGLER_READ_TIMEOUT } from '@mechane/deploy-kernel';
import type { SettingsInput } from '@mechane/deploy-kernel';
import { finishedProcess } from '@mechane/program';
import { Effect, Option } from 'effect';

/** A Dockerfile deployment needs its build engine before Wrangler activates any Worker code. */
export const checkDocker = Effect.fn('checkDocker')(function* ({
  settings,
}: SettingsInput): Effect.fn.Return<void, DeployFailed> {
  const container = Option.fromNullishOr(settings.installation.container);

  if (Option.isNone(container)) {
    return;
  }

  yield* finishedProcess({
    command: 'docker',
    args: ['info'],
    environment: settings.inherited,
    timeout: WRANGLER_READ_TIMEOUT,
  }).pipe(
    Effect.mapError(
      () =>
        new DeployFailed({
          step: DeployStep.RunDockerInfo,
          reason: 'Docker must be available to build the configured guest image',
        }),
    ),
  );
});
