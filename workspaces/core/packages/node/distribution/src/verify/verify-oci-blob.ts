import { Effect, Option } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { OciDescriptor } from './oci.schemas.ts';
import type { ScannedTarEntry } from './scan-oci-tar.ts';

type VerifyBlobInput = { readonly entries: ReadonlyMap<string, ScannedTarEntry>; readonly descriptor: OciDescriptor };

type BlobPathInput = { readonly sha256: string };

/** Returns the verified tar entry only after every byte matches its OCI descriptor hash and size. */
export const verifyOciBlob = Effect.fn('verifyOciBlob')(function* ({
  entries,
  descriptor,
}: VerifyBlobInput): Effect.fn.Return<ScannedTarEntry, DistributionFailed> {
  const sha256 = descriptor.digest.slice('sha256:'.length);
  const entry = blobPath({ sha256 });
  const measured = Option.fromNullishOr(entries.get(entry));

  if (Option.isNone(measured) || measured.value.sha256 !== sha256 || measured.value.bytes !== descriptor.size) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive blob differs from its descriptor',
    });
  }

  return measured.value;
});

function blobPath({ sha256 }: BlobPathInput): string {
  return `blobs/sha256/${sha256}`;
}
