import { ReleaseKey } from './constants.ts';
import type { ManifestKey, Release } from './schemas.ts';

/** The release whose manifest a key names. */
type ReleaseManifestKeyInput = { readonly release: Release };

/** The bucket key of a release's own manifest, in the release's folder, which a deployment serves at `/<key>`. */
export function releaseManifestKey({ release }: ReleaseManifestKeyInput): ManifestKey {
  return `${ReleaseKey.Folder}${release}${ReleaseKey.Manifest}`;
}
