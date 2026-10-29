import { ReleaseKey } from './constants.ts';

type LatestReleaseUrlInput = { readonly origin: URL };

/** The manifest of the latest release a deployment's origin publishes, which names that release's binaries. */
export function latestReleaseUrl({ origin }: LatestReleaseUrlInput): URL {
  return new URL(ReleaseKey.Latest, origin);
}
