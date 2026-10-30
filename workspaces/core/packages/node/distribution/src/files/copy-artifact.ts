import { Effect } from 'effect';
import { copyFile } from 'node:fs/promises';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type CopyArtifactInput = { readonly source: string; readonly path: string };

/** Preserves source bytes and maps filesystem errors to a distribution write failure. */
export const copyArtifact = Effect.fn('copyArtifact')(function* ({
  source,
  path,
}: CopyArtifactInput): Effect.fn.Return<void, DistributionFailed> {
  yield* Effect.tryPromise({
    try: () => copyFile(source, path),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});
