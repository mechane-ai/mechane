import { RELEASE } from '@mechane/protocol';
import { PUBLIC_REPOSITORY } from '../constants.ts';

type AssetUrlInput = { readonly name: string };

/** Pins an asset to this release's public GitHub download directory. */
export function releaseAssetUrl({ name }: AssetUrlInput): string {
  return `https://github.com/${PUBLIC_REPOSITORY}/releases/download/v${RELEASE}/${name}`;
}
