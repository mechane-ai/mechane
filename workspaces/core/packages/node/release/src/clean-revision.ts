import { workerRevision } from '@mechane/program';
import { Effect } from 'effect';
import { DIRTY_SUFFIX, ReleaseStep } from './constants.ts';
import { ReleaseFailed } from './errors.ts';
import type { InheritedInput } from './types.ts';

/**
 * The revision of the working tree, which a release records; a tree with uncommitted changes is refused, since no
 * commit holds the source such a release would be built from.
 */
export function cleanRevision({ inherited }: InheritedInput): Effect.Effect<string, ReleaseFailed> {
  return workerRevision({ environment: inherited, step: ReleaseStep.ReadRevision, failure: ReleaseFailed }).pipe(
    Effect.filterOrFail(
      (revision) => !revision.endsWith(DIRTY_SUFFIX),
      () =>
        new ReleaseFailed({
          step: ReleaseStep.ReadRevision,
          reason: 'the working tree has uncommitted changes; commit them, then build the release again',
        }),
    ),
  );
}
