import { workerRevision } from '@mechane/program';
import { Effect } from 'effect';
import { DIRTY_SUFFIX, ReleaseStep } from './constants.ts';
import { ReleaseFailed } from './errors.ts';
import type { InheritedInput } from './types.ts';

/**
 * The revision of the working tree, which a release records; a tree with uncommitted changes is refused, since no
 * commit holds the source such a release would be built from.
 */
export const cleanRevision = Effect.fn('cleanRevision')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<string, ReleaseFailed> {
  const revision = yield* workerRevision({
    environment: inherited,
    step: ReleaseStep.ReadRevision,
    failure: ReleaseFailed,
  });

  if (revision.endsWith(DIRTY_SUFFIX)) {
    return yield* new ReleaseFailed({
      step: ReleaseStep.ReadRevision,
      reason: 'the working tree has uncommitted changes; commit them, then build the release again',
    });
  }

  return revision;
});
