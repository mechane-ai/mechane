import { RELEASE } from '@mechane/protocol';

type AssetNameInput = { readonly kind: 'cloudflare' | 'guest' | 'setup-provider' };
const SUFFIXES = { 'cloudflare': 'zip', 'guest': 'oci.tar', 'setup-provider': 'sh' } as const;

/** Names a versioned installation asset at its immutable GitHub release URL. */
export function assetName({ kind }: AssetNameInput): string {
  return `mechane-${kind}-v${RELEASE}.${SUFFIXES[kind]}`;
}
