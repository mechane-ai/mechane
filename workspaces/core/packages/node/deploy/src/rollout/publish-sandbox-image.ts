import { DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import type { OperatorModeInput } from '@mechane/deploy-kernel';
import { WORKER_VARIABLES } from '@mechane/deployment';
import { finishedProcess } from '@mechane/program';
import { Duration, Effect, Option, Redacted } from 'effect';
import { fileURLToPath } from 'node:url';

const IMAGE_PROGRAM_URL: Readonly<URL> = new URL('../image/main.ts', import.meta.url);
const IMAGE_PROGRAM = fileURLToPath(IMAGE_PROGRAM_URL);
const IMAGE_TIMEOUT = Duration.minutes(25);

/** Publishes the configured Tensorlake image in an SDK child; Wrangler builds container images. */
export const publishSandboxImage = Effect.fn('publishSandboxImage')(function* ({
  settings,
  rendered,
}: OperatorModeInput): Effect.fn.Return<void, DeployFailed> {
  const imageName = Option.fromNullishOr(rendered.variables[WORKER_VARIABLES.tensorlakeImage]);

  if (Option.isNone(imageName)) {
    return;
  }

  const key = Option.fromNullishOr(settings.credentials.secrets[WORKER_VARIABLES.tensorlakeApiKey]);

  if (Option.isNone(key)) {
    return yield* new DeployFailed({
      step: DeployStep.PublishSandboxImage,
      reason: 'the Tensorlake image requires its configured secret reference',
    });
  }

  const environment = { ...settings.inherited, TENSORLAKE_API_KEY: Redacted.value(key.value) };

  const failure = new DeployFailed({
    step: DeployStep.PublishSandboxImage,
    reason: 'Tensorlake image publication failed',
  });

  yield* finishedProcess({
    command: 'node',
    args: [IMAGE_PROGRAM, imageName.value],
    environment,
    timeout: IMAGE_TIMEOUT,
  }).pipe(Effect.mapError(() => failure));
});
