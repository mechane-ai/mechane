import { RELEASE } from '@mechane/protocol';

type AssetNameInput = { readonly kind: 'cloudflare' | 'guest' };
const SUFFIXES = { cloudflare: 'zip', guest: 'oci.tar' } as const;

/** Names a versioned installation asset at its immutable GitHub release URL. */
export function assetName({ kind }: AssetNameInput): string {
  return `mechane-${kind}-v${RELEASE}.${SUFFIXES[kind]}`;
}
