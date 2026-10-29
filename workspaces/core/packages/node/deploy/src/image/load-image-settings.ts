import { DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Schema } from 'effect';

const ImageArguments = Schema.Tuple([Schema.NonEmptyString]);

/** The image child receives its release-specific image name and inherits only the SDK credential. */
export const loadImageSettings = Effect.fn('loadImageSettings')(function* (): Effect.fn.Return<string, DeployFailed> {
  const args = process.argv.slice(PROGRAM_ARGUMENTS_START);

  const [imageName] = yield* Schema.decodeUnknownEffect(ImageArguments)(args).pipe(
    Effect.mapError(
      () => new DeployFailed({ step: DeployStep.PublishSandboxImage, reason: 'name one Tensorlake release image' }),
    ),
  );

  return imageName;
});
