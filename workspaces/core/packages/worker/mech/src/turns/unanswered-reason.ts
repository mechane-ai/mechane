import { TurnFailure } from '@mechane/harness';
import { UnansweredReason } from '@mechane/protocol';

/** How pi failed a turn or a drone, and whether the allowance refused one of its dispatches. */
type UnansweredReasonInput = { readonly failure: TurnFailure; readonly isRefused: boolean };

type ModelFailureReasonInput = Pick<UnansweredReasonInput, 'isRefused'>;

/**
 * Why a turn or a drone ended without an answer when pi failed it: its own work faulted, or its model failed. A model
 * failure means it ran out of allowance when the allowance refused one of its dispatches.
 */
export function unansweredReason({ failure, isRefused }: UnansweredReasonInput): UnansweredReason {
  switch (failure) {
    case TurnFailure.Fault:
      return UnansweredReason.Faulted;
    case TurnFailure.Model:
      return modelFailureReason({ isRefused });
  }
}

/** Why a model failed a turn or a drone: it ran out of allowance when the allowance refused one of its dispatches. */
function modelFailureReason({ isRefused }: ModelFailureReasonInput): UnansweredReason {
  if (isRefused) {
    return UnansweredReason.AllowanceExhausted;
  }

  return UnansweredReason.ModelFailed;
}
