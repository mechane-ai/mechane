import { artifactDigest } from '@mechane/program';
import type { ArtifactDigest } from '@mechane/program';
import { Effect } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

type VerifyPackageFileInput = { readonly path: string; readonly expected: ArtifactDigest };

/** Rejects missing, replaced, or altered release files before any runtime process starts. */
export const verifyPackageFile = Effect.fn('verifyPackageFile')(function* ({
  path,
  expected,
}: VerifyPackageFileInput): Effect.fn.Return<void, StackFailed> {
  const actual = yield* artifactDigest({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step: StackStep.VerifyLocalPackage, reason: failure.reason })),
  );

  if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
    return yield* new StackFailed({ step: StackStep.VerifyLocalPackage, reason: `${path} differs from its manifest` });
  }
});
