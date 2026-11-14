import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import { DEFAULT_INSPECTION_OPTIONS, inspectEval, inspectionLines } from '@mechane/eval';
import { Effect } from 'effect';

export const runEvalInspect = Effect.fn('runEvalInspect')(function* ({
  input,
  write,
}: CommandRunInput<'eval inspect'>): Effect.fn.Return<RunOutcome, RunFailure> {
  const inspection = yield* inspectEval({
    ...DEFAULT_INSPECTION_OPTIONS,
    outFolder: input.outFolder,
    caseId: input.caseId,
  });

  const lines = inspectionLines({ inspection });

  write({ result: { lines, result: inspection } });

  return RunOutcome.Completed;
});
