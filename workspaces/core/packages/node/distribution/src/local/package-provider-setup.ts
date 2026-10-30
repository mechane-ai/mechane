import { Effect } from 'effect';
import { join } from 'node:path';
import { CORE_FOLDER } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { copyArtifact } from '../files/copy-artifact.ts';
import { fileDigest } from '../files/file-digest.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';

/** Stages the versioned helper consumed by release installation instructions. */
export const packageProviderSetup = Effect.fn('packageProviderSetup')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<Artifact, DistributionFailed> {
  const name = assetName({ kind: 'setup-provider' });
  const source = join(CORE_FOLDER, 'infrastructure', 'examples', 'cloudflare', 'setup-provider.sh');
  const path = join(settings.folder, name);

  yield* copyArtifact({ source, path });

  const digest = yield* fileDigest({ path });

  return { name, ...digest };
});
