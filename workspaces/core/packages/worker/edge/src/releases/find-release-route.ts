import { BinaryKey, INSTALL_SCRIPT_PATH, LatestKey, ManifestKey } from '@mechane/protocol';
import { HttpMethod, MediaType } from '@mechane/records';
import { Array, Duration, Option, Schema } from 'effect';
import { cacheControl } from './cache-control.ts';
import { REPLACED_FILE_LIFETIME } from './constants.ts';
import { serveInstallScript } from './serve-install-script.ts';
import { serveReleaseFile } from './serve-release-file.ts';
import type { ServeRelease } from './types.ts';

type FindReleaseRouteInput = { readonly method: string; readonly pathname: string };

/** How long a client may keep a release's own file, which never changes once published. */
const RELEASE_FILE_LIFETIME = Duration.days(365);

/** The caching of a file the next release replaces. */
const REPLACED_CACHE = cacheControl({ maxAge: REPLACED_FILE_LIFETIME, isImmutable: false });

/** The caching of a release's own file. */
const IMMUTABLE_CACHE = cacheControl({ maxAge: RELEASE_FILE_LIFETIME, isImmutable: true });

/** The kinds of file a release publishes, by the keys that hold them, with the type and caching each is served with. */
const RELEASE_FILES = [
  { key: LatestKey, contentType: MediaType.Json, cacheControl: REPLACED_CACHE },
  { key: ManifestKey, contentType: MediaType.Json, cacheControl: IMMUTABLE_CACHE },
  { key: BinaryKey, contentType: MediaType.OctetStream, cacheControl: IMMUTABLE_CACHE },
] as const;

/** One kind of file a release publishes. */
type ReleaseFile = (typeof RELEASE_FILES)[number];

/**
 * What serves `method` on `pathname` when it asks for the install script or for a key a release publishes, each at
 * `/<key>`. Any other request has none, since a page or the API serves it.
 */
export function findReleaseRoute({ method, pathname }: FindReleaseRouteInput): Option.Option<ServeRelease> {
  if (method !== HttpMethod.Get) {
    return Option.none();
  }

  if (pathname === INSTALL_SCRIPT_PATH) {
    return Option.some(serveInstallScript);
  }

  const key = pathname.slice(1);
  const holdsKey: (file: ReleaseFile) => boolean = (file) => Schema.is(file.key)(key);

  const servedFile: (file: ReleaseFile) => ServeRelease =
    (file) =>
    ({ settings }) =>
      serveReleaseFile({ settings, key, file });

  return Option.map(Array.findFirst(RELEASE_FILES, holdsKey), servedFile);
}
