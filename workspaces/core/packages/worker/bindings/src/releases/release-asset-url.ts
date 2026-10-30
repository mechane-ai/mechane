import type { ReleaseAssetLocation } from './types.ts';

type ReleaseAssetUrlInput = ReleaseAssetLocation & { readonly origin: URL };

/** Builds a download URL beneath the artifact base from a validated release and an allowlisted filename. */
export function releaseAssetUrl({ origin, release, filename }: ReleaseAssetUrlInput): URL {
  const directory = new URL(origin);
  directory.pathname = `${directory.pathname.replace(/\/$/u, '')}/`;

  const path = releaseAssetPath({ release, filename });

  return new URL(path, directory);
}

function releaseAssetPath({ release, filename }: ReleaseAssetLocation): string {
  const version = encodeURIComponent(release);
  const asset = encodeURIComponent(filename);

  return `v${version}/${asset}`;
}
