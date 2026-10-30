import { LocalTarget } from '@mechane/stack';
import { Effect, Record } from 'effect';
import type { DistributionFailed } from '../errors.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { packageLocal } from './package-local.ts';
import { readCelldRelease } from './read-celld-release.ts';

type BuildLocalAssetsInput = { readonly settings: DistributionSettings; readonly commit: string };

/** Builds every supported target sequentially from one pinned celld release. */
export const buildLocalAssets = Effect.fn('buildLocalAssets')(function* ({
  settings,
  commit,
}: BuildLocalAssetsInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const release = yield* readCelldRelease();
  const targets = Record.values(LocalTarget);

  return yield* Effect.forEach(targets, (target) => packageLocal({ target, commit, release, settings }), {
    concurrency: 1,
  });
});
