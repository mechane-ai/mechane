import { Sequence } from '@mechane/records';
import { DateTime, Effect } from 'effect';
import type { EvalStageFailure } from '../application-schemas.ts';
import type { ApplicationTrialFiles } from '../application-types.ts';
import type { EvalRunFailure } from '../types.ts';

type RecordTrialFailureInput = {
  readonly files: Pick<ApplicationTrialFiles, 'readFailures' | 'saveFailure'>;
  readonly failure: Pick<EvalStageFailure, 'stage' | 'tag' | 'reason'>;
};

/** Earlier attempts remain in the journal after a later recovery succeeds. */
export const recordTrialFailure = Effect.fn('recordTrialFailure')(function* ({
  files,
  failure,
}: RecordTrialFailureInput): Effect.fn.Return<void, EvalRunFailure> {
  const previous = yield* files.readFailures();
  const observedAt = DateTime.nowUnsafe();
  const sequence = Sequence.make(previous.length + 1);
  const record = { ...failure, sequence, observedAt };

  yield* files.saveFailure({ failure: record });
});
