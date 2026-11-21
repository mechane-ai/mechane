import { CliTarget, RELEASE } from '@mechane/releases';
import { Effect, Record } from 'effect';
import { rm } from 'node:fs/promises';
import { cleanRevision } from '../clean-revision.ts';
import { RELEASE_BUILD_FOLDER, ReleaseStep } from '../constants.ts';
import { ReleaseFailed } from '../errors.ts';
import type { InheritedInput } from '../types.ts';
import { buildRelease } from './build-release.ts';
import type { BuiltRelease } from './types.ts';

/**
 * Builds the release this source declares for every target into the release folder, emptied first so it holds that
 * release alone. It builds from a clean working tree, whose revision its manifest records, and an upload then publishes
 * it.
 */
export const buildSourceRelease = Effect.fn('buildSourceRelease')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<BuiltRelease, ReleaseFailed> {
  yield* Effect.tryPromise({
    try: () => rm(RELEASE_BUILD_FOLDER, { recursive: true, force: true }),
    catch: (cause) => new ReleaseFailed({ step: ReleaseStep.EmptyBuildFolder, reason: String(cause) }),
  });

  const revision = yield* cleanRevision({ inherited });

  return yield* buildRelease({
    release: RELEASE,
    revision,
    targets: Record.values(CliTarget),
    folder: RELEASE_BUILD_FOLDER,
    inherited,
  });
});
