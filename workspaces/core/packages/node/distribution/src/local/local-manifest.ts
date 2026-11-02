import { LOCAL_PACKAGE_FILES, LOCAL_PACKAGE_FORMAT_VERSION } from '@mechane/stack';
import type { LocalPackage, LocalTarget } from '@mechane/stack';
import { Effect } from 'effect';
import { join } from 'node:path';
import { distributionDescriptor } from '../build/release-descriptor.ts';
import { PUBLIC_REPOSITORY } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { guestImageName } from './guest-image-name.ts';

type LocalManifestInput = { readonly folder: string; readonly target: LocalTarget; readonly commit: string };

/** Binds each runtime input to its exact bytes and the public source commit. */
export const localManifest = Effect.fn('localManifest')(function* ({
  folder,
  target,
  commit,
}: LocalManifestInput): Effect.fn.Return<LocalPackage, DistributionFailed> {
  const { configuration: base, console, ...descriptor } = yield* distributionDescriptor({ commit, isPreview: false });
  const guestPath = join(folder, LOCAL_PACKAGE_FILES.guest);
  const celldPath = join(folder, LOCAL_PACKAGE_FILES.celld);
  const cliPath = join(folder, LOCAL_PACKAGE_FILES.cli);
  const guest = yield* fileDigest({ path: guestPath });
  const celld = yield* fileDigest({ path: celldPath });
  const cli = yield* fileDigest({ path: cliPath });
  const image = guestImageName();
  const containers = base.containers.map((container) => ({ ...container, image }));
  const origin = releaseOriginUrl();
  const vars = { ...base.vars, MECHANE_RELEASE_ORIGIN: origin };

  return {
    format_version: LOCAL_PACKAGE_FORMAT_VERSION,
    ...descriptor,
    target,
    configuration: { ...base, containers, vars },
    files: { 'guest.oci.tar': guest, celld, 'mechane': cli, 'console.json': console },
  };
});

function releaseOriginUrl(): string {
  return `https://github.com/${PUBLIC_REPOSITORY}/releases/download`;
}
