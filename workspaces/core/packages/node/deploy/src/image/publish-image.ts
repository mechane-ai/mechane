import { DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import { CloudClient } from '@tensorlakeai/tensorlake';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { buildImage } from './build-image.ts';
import { closeImageClient } from './close-image-client.ts';
import { loadImageSettings } from './load-image-settings.ts';

/** Creates the native SDK client inside its scope's acquisition. */
const ACQUIRE_CLIENT = Effect.try({
  try: () => CloudClient.forCloud(),
  catch: () => new DeployFailed({ step: DeployStep.PublishSandboxImage, reason: 'Tensorlake client creation failed' }),
});

/** Keeps the native SDK client scoped to this image publication. */
export const publishImage = Effect.fn('publishImage')(function* (): Effect.fn.Return<void, DeployFailed, Scope.Scope> {
  const imageName = yield* loadImageSettings();
  const client = yield* Effect.acquireRelease(ACQUIRE_CLIENT, closeImageClient);

  yield* buildImage({ client, imageName });
});
