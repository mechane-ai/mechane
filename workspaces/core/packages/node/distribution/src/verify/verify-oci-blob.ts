import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveEntryDigest } from '../files/archive-entry-digest.ts';
import type { DistributionSettings } from '../types.ts';
import type { OciDescriptor } from './oci.schemas.ts';

type VerifyBlobInput = {
  readonly path: string;
  readonly descriptor: OciDescriptor;
  readonly settings: DistributionSettings;
};

type BlobPathInput = { readonly sha256: string };

/** Returns the descriptor's archive path only after every byte matches its hash and size. */
export const verifyOciBlob = Effect.fn('verifyOciBlob')(function* ({
  path,
  descriptor,
  settings,
}: VerifyBlobInput): Effect.fn.Return<string, DistributionFailed> {
  const sha256 = descriptor.digest.slice('sha256:'.length);
  const entry = blobPath({ sha256 });
  const measured = yield* archiveEntryDigest({ path, entry, settings });

  if (measured.sha256 !== sha256 || measured.bytes !== descriptor.size) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive blob differs from its descriptor',
    });
  }

  return entry;
});

function blobPath({ sha256 }: BlobPathInput): string {
  return `blobs/sha256/${sha256}`;
}
