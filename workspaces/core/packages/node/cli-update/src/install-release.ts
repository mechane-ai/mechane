import {
  BinaryMismatched,
  DigestMismatched,
  ReplaceFailed,
  SizeMismatched,
  TargetUnpublished,
} from '@mechane/cli-kernel';
import type { ReleasedBinary, UpdateFailure } from '@mechane/cli-kernel';
import { download } from '@mechane/client';
import type { ClientFailure } from '@mechane/client';
import { replaceFile, sha256Hex } from '@mechane/program';
import type { FileWriteFailed } from '@mechane/program';
import type { Release, ReleaseManifest } from '@mechane/protocol';
import { Bytes } from '@mechane/records';
import { Duration, Effect, Match, Option, Record } from 'effect';
import { reportedRelease } from './reported-release.ts';

type InstallReleaseInput = {
  readonly origin: URL;
  readonly latest: ReleaseManifest;
  readonly binary: ReleasedBinary;
  readonly userAgent: string;
};

/** The binary to download for a release, where it is, and the program that downloads it. */
type PublishedBytesInput = {
  readonly url: URL;
  readonly published: ReleaseManifest['binaries'][string];
  readonly release: Release;
  readonly userAgent: string;
};

/** The fresh binary beside the running one, which must report its release before it replaces it. */
type FreshBinary = { readonly path: string };

/** How long the download of a release's binary may take: it holds the Bun runtime, tens of megabytes. */
const DOWNLOAD_TIMEOUT = Duration.minutes(10);

/** The mode of an installed binary: its owner may write it, and everyone may read and run it. */
const EXECUTABLE_MODE = 0o755;

/**
 * Installs the latest release's binary for this CLI's target over the running one. It does so only once the downloaded
 * bytes have the manifest's size and SHA-256, and the new binary reports that release.
 */
export const installRelease = Effect.fn('installRelease')(function* ({
  origin,
  latest,
  binary,
  userAgent,
}: InstallReleaseInput): Effect.fn.Return<void, UpdateFailure | ClientFailure> {
  const { release } = latest;
  const published = Record.get(latest.binaries, binary.target);

  if (Option.isNone(published)) {
    return yield* new TargetUnpublished({ release, target: binary.target });
  }

  const url = new URL(published.value.path, origin);
  const bytes = yield* publishedBytes({ url, published: published.value, release, userAgent });

  const accept: (fresh: FreshBinary) => Effect.Effect<void, BinaryMismatched> = ({ path }) =>
    reportedRelease({ path, url, release });

  const replaceFailure: (failure: FileWriteFailed | BinaryMismatched) => ReplaceFailed | BinaryMismatched = (failure) =>
    Match.valueTags(failure, {
      FileWriteFailed: ({ step, path, reason }) => new ReplaceFailed({ step, path, reason }),
      BinaryMismatched: (mismatched) => mismatched,
    });

  yield* replaceFile({ path: binary.path, contents: bytes, mode: EXECUTABLE_MODE, accept: Option.some(accept) }).pipe(
    Effect.mapError(replaceFailure),
  );
});

/** The bytes of the binary at `url`, once they have the size and the SHA-256 the release's manifest names. */
const publishedBytes = Effect.fn('publishedBytes')(function* ({
  url,
  published,
  release,
  userAgent,
}: PublishedBytesInput): Effect.fn.Return<Uint8Array, BinaryMismatched | ClientFailure> {
  const bytes = yield* download({ url, timeout: DOWNLOAD_TIMEOUT, userAgent });
  const sha256 = sha256Hex({ contents: bytes });

  if (bytes.byteLength !== published.bytes) {
    const mismatch = new SizeMismatched({
      release,
      bytes: Bytes.make(bytes.byteLength),
      manifestBytes: Bytes.make(published.bytes),
    });

    return yield* new BinaryMismatched({ url, mismatch });
  }

  if (sha256 !== published.sha256) {
    const mismatch = new DigestMismatched({ release, sha256, manifestSha256: published.sha256 });

    return yield* new BinaryMismatched({ url, mismatch });
  }

  return bytes;
});
