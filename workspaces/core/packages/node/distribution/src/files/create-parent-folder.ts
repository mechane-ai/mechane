import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { PathInput } from '../types.ts';

export const createParentFolder = Effect.fn('createParentFolder')(function* ({
  path,
}: PathInput): Effect.fn.Return<void, DistributionFailed> {
  const parent = dirname(path);

  yield* Effect.tryPromise({
    try: () => mkdir(parent, { recursive: true }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});
