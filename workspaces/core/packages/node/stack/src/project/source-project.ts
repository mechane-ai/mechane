import { readBuiltRelease, releasesBucket, WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { RuntimeProject } from '../types.ts';

/** Uses configuration and format metadata recorded with the verified Worker build. */
export const sourceProject = Effect.fn('sourceProject')(function* (): Effect.fn.Return<RuntimeProject, StackFailed> {
  const release = yield* readBuiltRelease().pipe(
    Effect.mapError((failure) => new StackFailed({ step: StackStep.ReadLocalPackage, reason: failure.reason })),
  );

  const configuration = release.configuration;
  const bucket = yield* releasesBucket({ configuration, step: StackStep.FindReleasesBucket, failure: StackFailed });

  return {
    release,
    bundle: WORKER_BUNDLE,
    configuration,
    revision: release.public_commit,
    celldCommand: 'celld',
    releasesBucket: bucket,
  };
});
