import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type StagingFolderInput = { readonly prefix: string };

/** Creates a private temporary staging directory removed automatically when its Effect scope closes. */
export const acquireStagingFolder = Effect.fn('acquireStagingFolder')(function* ({
  prefix,
}: StagingFolderInput): Effect.fn.Return<string, DistributionFailed, Scope.Scope> {
  const create = Effect.tryPromise({
    try: () => mkdtemp(join(tmpdir(), prefix)),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  return yield* Effect.acquireRelease(create, (folder) =>
    Effect.ignore(
      Effect.tryPromise({
        try: () => rm(folder, { recursive: true, force: true }),
        catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
      }),
    ),
  );
});
