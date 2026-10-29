import { DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import { createSandboxImage } from '@tensorlakeai/tensorlake';
import type { CloudClient } from '@tensorlakeai/tensorlake';
import { Duration, Effect, Option } from 'effect';
import { fileURLToPath } from 'node:url';

const IMAGE_TIMEOUT = Duration.minutes(20);
const DOCKER_FILE_URL: Readonly<URL> = new URL('../../../guest/image/Dockerfile', import.meta.url);
const DOCKER_FILE = fileURLToPath(DOCKER_FILE_URL);
type BuildImageInput = { readonly client: CloudClient; readonly imageName: string };

/** Publishes each release image once; the build context contains only the Dockerfile and bundled guest. */
export const buildImage = Effect.fn('buildImage')(function* ({
  client,
  imageName,
}: BuildImageInput): Effect.fn.Return<void, DeployFailed> {
  const existing = yield* Effect.tryPromise({
    try: () => client.findSandboxImageByName(imageName),
    catch: () => new DeployFailed({ step: DeployStep.PublishSandboxImage, reason: 'Tensorlake image lookup failed' }),
  });

  const found = Option.fromNullishOr(existing);

  if (Option.isSome(found)) {
    return;
  }

  const timeout = Duration.toMillis(IMAGE_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const options = { registeredName: imageName, dockerConfigJson: '{}', isPublic: false, signal };

  yield* Effect.tryPromise({
    try: () => createSandboxImage(DOCKER_FILE, options),
    catch: () => new DeployFailed({ step: DeployStep.PublishSandboxImage, reason: 'Tensorlake image build failed' }),
  });
});
