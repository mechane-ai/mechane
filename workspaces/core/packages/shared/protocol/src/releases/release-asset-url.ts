import { RELEASE } from '../release.ts';
import { RELEASE_REPOSITORY } from './constants.ts';

type ReleaseAssetUrlInput = { readonly name: string };

/**
 * Pins an asset filename to this source's release in the public repository. The filename is encoded as one path
 * segment.
 */
export function releaseAssetUrl({ name }: ReleaseAssetUrlInput): string {
  return `https://github.com/${RELEASE_REPOSITORY}/releases/download/v${RELEASE}/${encodeURIComponent(name)}`;
}
