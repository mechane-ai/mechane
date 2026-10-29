import { TurnStatus } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { EvalFileFailed } from '../errors.ts';
import type { TrialFiles } from '../types.ts';

type UnsavedTurnsInput = { readonly files: TrialFiles };

/** The turns a trial sends: its subject's, then its grader's. */
const TURNS_PER_TRIAL = 2;

/**
 * How many of a trial's turns are not saved yet, which a run sends: both before its subject's record, and the grader's
 * after a saved answer before the grader's record. None remain once both were saved or the subject's turn failed.
 */
export const unsavedTurns = Effect.fn('unsavedTurns')(function* ({
  files,
}: UnsavedTurnsInput): Effect.fn.Return<number, EvalFileFailed> {
  const subject = yield* files.subject.read();

  if (Option.isNone(subject)) {
    return TURNS_PER_TRIAL;
  }

  if (subject.value.outcome.status === TurnStatus.Answered && Option.isNone(yield* files.grade.read())) {
    return 1;
  }

  return 0;
});
