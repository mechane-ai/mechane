import type { Release } from '@mechane/protocol';

/** A validated release and public artifact name chosen from the served CLI routes. */
export type ReleaseAssetLocation = { readonly release: Release; readonly filename: string };
