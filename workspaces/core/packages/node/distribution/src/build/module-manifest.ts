import { Effect } from 'effect';
import type { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import type { Artifact } from '../schemas.ts';
import { moduleSourceFiles } from './module-source-files.ts';
import type { ModuleSourceFile } from './types.ts';

type ModuleManifestInput = { readonly isPreview: boolean };

/** Hashes only declared module sources and notices; preview metadata omits notices. */
export const moduleManifest = Effect.fn('moduleManifest')(function* ({
  isPreview,
}: ModuleManifestInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const files = yield* moduleSourceFiles({ isPreview });

  return yield* Effect.forEach(files, describeFile, { concurrency: 1 });
});

const describeFile = Effect.fn('describeFile')(function* ({
  name,
  path,
}: ModuleSourceFile): Effect.fn.Return<Artifact, DistributionFailed> {
  const checksum = yield* fileDigest({ path });

  return { name, ...checksum };
});
