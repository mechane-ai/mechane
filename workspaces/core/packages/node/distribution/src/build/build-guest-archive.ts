import { Effect } from 'effect';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { runCommand } from '../files/run-command.ts';
import type { DistributionInput, PathInput } from '../types.ts';
import { guestImageDigest } from '../verify/guest-image-digest.ts';
import type { GuestImage } from './types.ts';

type GuestArtifact = GuestImage & { readonly name: string };
const GUEST_URL: Readonly<URL> = new URL('../../../guest/image', import.meta.url);
const GUEST_FOLDER = fileURLToPath(GUEST_URL);

/** Exports one Linux amd64 image as OCI bytes that an installation can copy without Docker. */
export const buildGuestArchive = Effect.fn('buildGuestArchive')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<GuestArtifact, DistributionFailed> {
  const name = assetName({ kind: 'guest' });
  const path = join(settings.folder, name);
  const output = archiveOutput({ path });

  yield* runCommand({
    command: 'docker',
    args: [
      'buildx',
      'build',
      '--platform=linux/amd64',
      '--provenance=false',
      '--sbom=false',
      '--output',
      output,
      GUEST_FOLDER,
    ],
    settings,
  });

  const checksum = yield* fileDigest({ path });
  const digest = yield* guestImageDigest({ path, settings });

  return { name, ...checksum, digest };
});

function archiveOutput({ path }: PathInput): string {
  return `type=oci,dest=${path}`;
}
