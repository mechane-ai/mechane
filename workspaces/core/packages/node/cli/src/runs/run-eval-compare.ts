import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import {
  compareEval,
  comparisonLines,
  DEFAULT_COMPARISON_OPTIONS,
  DEFAULT_INSPECTION_OPTIONS,
  inspectEval,
} from '@mechane/eval';
import { Effect } from 'effect';

export const runEvalCompare = Effect.fn('runEvalCompare')(function* ({
  input,
  write,
}: CommandRunInput<'eval compare'>): Effect.fn.Return<RunOutcome, RunFailure> {
  const baseline = yield* inspectEval({ outFolder: input.baselineFolder, ...DEFAULT_INSPECTION_OPTIONS });
  const candidate = yield* inspectEval({ outFolder: input.candidateFolder, ...DEFAULT_INSPECTION_OPTIONS });
  const comparison = compareEval({ baseline, candidate, ...DEFAULT_COMPARISON_OPTIONS });
  const lines = comparisonLines({ comparison });

  write({ result: { lines, result: comparison } });

  if (!comparison.isComparable) {
    return RunOutcome.Incomplete;
  }

  if (input.shouldFailOnRegression && comparison.isComplete && comparison.hasRegression) {
    return RunOutcome.Incomplete;
  }

  return RunOutcome.Completed;
});
