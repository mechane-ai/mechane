import { DeployFailed, PROGRAM, wranglerVariables } from '@mechane/deploy-kernel';
import type { OperatorModeInput } from '@mechane/deploy-kernel';
import { writeDiagnostic } from '@mechane/program';
import { RELEASE, releaseManifestKey } from '@mechane/protocol';
import { buildSourceRelease, isKeyPublished, RELEASE_BUILD_FOLDER, uploadRelease } from '@mechane/release';
import { Effect } from 'effect';

/**
 * Builds this source's CLI release and uploads it through the release program, unless the bucket holds its manifest
 * already. It runs once readiness reports the new Worker, so no CLI of this release meets an older Worker.
 */
export function publishCliRelease({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  const key = releaseManifestKey({ release: RELEASE });
  const inherited = wranglerVariables({ settings, credentials: settings.credentials });

  return Effect.gen(function* () {
    const bucket = rendered.releasesBucket;

    if (yield* isKeyPublished({ bucket, key, inherited })) {
      return writeDiagnostic({ program: PROGRAM, line: `cli release: ${bucket}/${key} is published already` });
    }

    yield* buildSourceRelease({ inherited: settings.inherited });
    yield* uploadRelease({ directory: RELEASE_BUILD_FOLDER, bucket, inherited });
    writeDiagnostic({ program: PROGRAM, line: `cli release: uploaded release ${RELEASE} to ${bucket}` });
  }).pipe(Effect.mapError(({ step, subjects, reason }) => new DeployFailed({ step, subjects, reason })));
}
