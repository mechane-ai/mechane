import { Array, Effect, Option } from 'effect';
import type { Cause } from 'effect';
import type { BaseConfiguration } from './schemas.ts';
import type { ProgramFailureInput } from './types.ts';

/** The Worker's binding of the releases bucket, by which the Wrangler configuration names the bucket. */
const RELEASES_BINDING = 'RELEASES';
type ReleasesBucketInput<S, E> = ProgramFailureInput<S, E> & { readonly configuration: BaseConfiguration };

/**
 * Finds the release bucket in decoded runtime configuration so source builds and installed packages use one binding. A
 * missing binding fails at the caller's requested step.
 */
export const releasesBucket = Effect.fn('releasesBucket')(function* <S, E extends Cause.YieldableError>({
  step,
  failure: Failure,
  configuration,
}: ReleasesBucketInput<S, E>): Effect.fn.Return<string, E> {
  const buckets = configuration.r2_buckets;
  const releases = Array.findFirst(buckets, (bucket) => bucket.binding === RELEASES_BINDING);

  if (Option.isNone(releases)) {
    return yield* new Failure({ step, subjects: [], reason: `no r2_buckets entry binds ${RELEASES_BINDING}` });
  }

  return releases.value.bucket_name;
});
