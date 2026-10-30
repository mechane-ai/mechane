import { RELEASE } from '@mechane/protocol';
import { LOCAL_PACKAGE_FILES } from '@mechane/stack';
import type { LocalPackage, LocalTarget } from '@mechane/stack';
import { baseConfiguration } from '@mechane/wrangler';
import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep, PUBLIC_REPOSITORY } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { guestImageName } from './guest-image-name.ts';

type LocalManifestInput = { readonly folder: string; readonly target: LocalTarget; readonly commit: string };

/** Binds each runtime input to its exact bytes and the public source commit. */
export const localManifest = Effect.fn('localManifest')(function* ({
  folder,
  target,
  commit,
}: LocalManifestInput): Effect.fn.Return<LocalPackage, DistributionFailed> {
  const base = yield* baseConfiguration({ step: DistributionStep.Read, failure: DistributionFailed });
  const workerPath = join(folder, LOCAL_PACKAGE_FILES.worker);
  const guestPath = join(folder, LOCAL_PACKAGE_FILES.guest);
  const celldPath = join(folder, LOCAL_PACKAGE_FILES.celld);
  const cliPath = join(folder, LOCAL_PACKAGE_FILES.cli);
  const worker = yield* fileDigest({ path: workerPath });
  const guest = yield* fileDigest({ path: guestPath });
  const celld = yield* fileDigest({ path: celldPath });
  const cli = yield* fileDigest({ path: cliPath });
  const image = guestImageName();
  const containers = base.containers.map((container) => ({ ...container, image }));
  const origin = releaseOriginUrl();
  const vars = { ...base.vars, MECHANE_RELEASE_ORIGIN: origin };

  return {
    format_version: 1,
    version: RELEASE,
    public_commit: commit,
    target,
    configuration: { ...base, containers, vars },
    files: { 'worker.js': worker, 'guest.oci.tar': guest, celld, 'mechane': cli },
  };
});

function releaseOriginUrl(): string {
  return `https://github.com/${PUBLIC_REPOSITORY}/releases/download`;
}
