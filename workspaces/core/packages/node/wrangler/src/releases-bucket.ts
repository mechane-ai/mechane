import { Array, Effect, Option } from 'effect';
import type { Cause } from 'effect';
import { baseConfiguration } from './base-configuration.ts';
import { WRANGLER_CONFIGURATION } from './constants.ts';
import type { ProgramFailureInput } from './types.ts';

/** The Worker's binding of the releases bucket, by which the Wrangler configuration names the bucket. */
const RELEASES_BINDING = 'RELEASES';

/**
 * The name of the bucket the Wrangler configuration binds as the Worker's releases. It keys the bucket both in R2,
 * where Wrangler uploads a release, and in celld's local object store, where the stack publishes one. It fails as the
 * program's `failure` of `step`, whether the configuration's read failed or it binds no such bucket.
 */
export const releasesBucket = Effect.fn('releasesBucket')(function* <S, E extends Cause.YieldableError>({
  step,
  failure: Failure,
}: ProgramFailureInput<S, E>): Effect.fn.Return<string, E> {
  const { r2_buckets: buckets } = yield* baseConfiguration({ step, failure: Failure });
  const releases = Array.findFirst(buckets, (bucket) => bucket.binding === RELEASES_BINDING);

  if (Option.isNone(releases)) {
    return yield* new Failure({
      step,
      subjects: [],
      reason: `no r2_buckets entry of ${WRANGLER_CONFIGURATION} binds ${RELEASES_BINDING}`,
    });
  }

  return releases.value.bucket_name;
});
