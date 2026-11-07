import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type TemporaryFolderInput = { readonly prefix: string };

/** Releases archive staging and extraction files when their operation leaves its scope. */
export const temporaryFolder = Effect.fn('temporaryFolder')(function* ({
  prefix,
}: TemporaryFolderInput): Effect.fn.Return<string, DistributionFailed, Scope.Scope> {
  return yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), prefix)),
      catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
    }),
    (folder) =>
      Effect.tryPromise({
        try: () => rm(folder, { recursive: true, force: true }),
        catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
      }).pipe(Effect.orDie),
  );
});
