import type { Turn, TurnPage } from '@mechane/protocol';

type ListedTurn = TurnPage['turns'][number];

/** A readable outcome for the recorded turn state. */
export function outcomeLabel(status: ListedTurn['status']): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'waiting':
      return 'Waiting';
    case 'answered':
      return 'Answered';
    case 'running':
      return 'Running';
    case 'unanswered':
      return 'Ended without a reply';
    default:
      return 'Newer turn format';
  }
}

/** The recorded stop reason in operator-facing language. */
export function outcomeReason(reason: Extract<Turn, { readonly status: 'unanswered' }>['reason']): string {
  switch (reason) {
    case 'allowance_exhausted':
      return 'The workspace allowance or this mech’s daily cap could not cover the request.';
    case 'model_failed':
      return 'The model request failed after its retries.';
    case 'faulted':
      return 'The mech encountered an error while working on this turn.';
    case 'canceled':
      return 'The turn stopped after a member requested cancellation.';
    default:
      return reason.replaceAll('_', ' ');
  }
}
