import type { ReleaseManifest } from '@mechane/protocol';

/** A built release's manifest, and the manifest as the release's files hold it. */
export type BuiltRelease = { readonly manifest: ReleaseManifest; readonly text: string };
