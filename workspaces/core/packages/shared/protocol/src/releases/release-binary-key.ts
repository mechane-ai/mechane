import { ReleaseKey } from './constants.ts';
import type { CliTarget } from './constants.ts';
import type { BinaryKey, Release } from './schemas.ts';

/** The release and the target whose binary a key names. */
type ReleaseBinaryKeyInput = { readonly release: Release; readonly target: CliTarget };

/** The bucket key of a target's binary, in its release's folder, which the release's manifest names as its path. */
export function releaseBinaryKey({ release, target }: ReleaseBinaryKeyInput): BinaryKey {
  return `${ReleaseKey.Folder}${release}${ReleaseKey.Binary}${target}`;
}
