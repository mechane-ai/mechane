import { Effect, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { ArtifactDigest } from '../release-descriptor.ts';

/** A runtime artifact must be a readable regular file before its bytes can be trusted. */
class ArtifactUnreadable extends Schema.TaggedError<ArtifactUnreadable>()('ArtifactUnreadable', {
  path: Schema.String,
  reason: Schema.String,
}) {}

type ArtifactDigestInput = { readonly path: string };

/** Streams an artifact's checksum without loading a container image or executable into memory. */
export const artifactDigest = Effect.fn('artifactDigest')(function* ({
  path,
}: ArtifactDigestInput): Effect.fn.Return<ArtifactDigest, ArtifactUnreadable> {
  const status = yield* Effect.tryPromise({
    try: () => lstat(path),
    catch: (cause) => new ArtifactUnreadable({ path, reason: String(cause) }),
  });

  if (!status.isFile()) {
    return yield* new ArtifactUnreadable({ path, reason: 'artifact must be a regular file' });
  }

  const sha256 = yield* Effect.tryPromise({
    try: (signal) => hashArtifact({ path, signal }),
    catch: (cause) => new ArtifactUnreadable({ path, reason: String(cause) }),
  });

  return { sha256, bytes: status.size };
});

type HashArtifactInput = ArtifactDigestInput & { readonly signal: AbortSignal };

async function hashArtifact({ path, signal }: HashArtifactInput): Promise<string> {
  const hash = createHash('sha256');
  const source = createReadStream(path);

  await pipeline(source, hash, { signal });

  return hash.digest('hex');
}
