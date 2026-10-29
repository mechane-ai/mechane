import { TurnFailure } from '../constants.ts';
import type { PiSubmissionStatus } from './constants.ts';
import { ItemEnded } from './schemas.ts';
import type { InputRecord } from './types.ts';

/** pi's reason for an unanswered input. */
type UnansweredEndInput = Pick<Extract<InputRecord, UnansweredStatus>, 'reason'>;

/** The status of a submission pi can no longer answer. */
type UnansweredStatus = { readonly status: typeof PiSubmissionStatus.Unanswered };

/** pi's reasons for an unanswered input that mean the model failed, rather than the turn's own work. */
const MODEL_FAILURE_REASONS: ReadonlySet<string> = new Set(['model_error', 'no_model']);

/** An unanswered input's end: its model failed for pi's model reasons, and its own work faulted for any other. */
export function unansweredEnd({ reason }: UnansweredEndInput): ItemEnded {
  if (MODEL_FAILURE_REASONS.has(reason)) {
    return ItemEnded.cases.Unanswered.make({ failure: TurnFailure.Model });
  }

  return ItemEnded.cases.Unanswered.make({ failure: TurnFailure.Fault });
}
