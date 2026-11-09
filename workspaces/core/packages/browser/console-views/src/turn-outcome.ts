import type { Turn, TurnPage } from '@mechane/protocol';

type ListedTurn = TurnPage['turns'][number];

/** A readable outcome for the recorded turn state. */
export function outcomeLabel(status: ListedTurn['status']): string {
  switch (status) {
    case 'queued':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Newer run format';
  }
}

/** The recorded stop reason in operator-facing language. */
export function outcomeReason(reason: Extract<Turn, { readonly status: 'failed' }>['reason']): string {
  switch (reason) {
    case 'allowance_exhausted':
      return 'The workspace allowance or this mech’s daily cap could not cover the request.';
    case 'model_failed':
      return 'The model request failed after its retries.';
    case 'faulted':
      return 'The mech encountered an error during this run.';
    case 'canceled':
      return 'The run stopped after a member requested it.';
    default:
      return reason.replaceAll('_', ' ');
  }
}
