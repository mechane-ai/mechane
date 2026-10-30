import {
  CliTarget,
  Release,
  RELEASE,
  ReleaseAsset,
  releaseBinaryKey,
  releaseBinaryName,
  ReleaseKey,
  releaseManifestKey,
} from '@mechane/protocol';
import { Array, Option, Record, Schema } from 'effect';
import type { ReleaseAssetLocation } from './types.ts';

type FindReleaseAssetInput = { readonly key: string };

/**
 * Maps CLI keys to allowlisted versioned artifacts, retaining historical releases so cached manifests can finish
 * updates.
 */
export function findReleaseAsset({ key }: FindReleaseAssetInput): Option.Option<ReleaseAssetLocation> {
  if (key === ReleaseKey.Latest) {
    return Option.some({ release: RELEASE, filename: ReleaseAsset.Manifest });
  }

  const separator = key.indexOf('/', ReleaseKey.Folder.length);
  const release = key.slice(ReleaseKey.Folder.length, separator);

  if (!Schema.is(Release)(release)) {
    return Option.none();
  }

  const manifestKey = releaseManifestKey({ release });

  if (key === manifestKey) {
    return Option.some({ release, filename: ReleaseAsset.Manifest });
  }

  const targets = Record.values(CliTarget);

  const matchesTarget: (target: CliTarget) => boolean = (target) => key === releaseBinaryKey({ release, target });

  const target = Array.findFirst(targets, matchesTarget);

  const location: (value: CliTarget) => ReleaseAssetLocation = (value) => {
    const filename = releaseBinaryName({ target: value });

    return { release, filename };
  };

  return Option.map(target, location);
}
