import type { Run } from '../domain.ts';
import type { RunOutcome } from './types.ts';

const CANCELLATION_MESSAGE =
  'This run was stopped. Cancellation does not undo completed commands or guarantee that every external command stopped. Inspect external effects before retrying.';

export function terminalOutcome(run: Run): RunOutcome {
  switch (run.status) {
    case 'completed':
      return { runId: run.id, status: 'completed', error: null };
    case 'failed':
      return { runId: run.id, status: 'failed', error: run.error ?? runFailureMessage(run.failureReason) };
    case 'cancelled':
      return { runId: run.id, status: 'cancelled', error: CANCELLATION_MESSAGE };
    case 'queued':
    case 'running':
    case 'waiting':
      throw new Error('Run has no committed terminal outcome');
  }
}

export function runFailureMessage(reason: string | null): string {
  if (reason === 'allowance_exhausted') {
    return 'This run reached its daily budget before completing the request. Increase the allowance or continue after the daily reset.';
  }

  return 'The run stopped before completing the request. Open the run for its current status, or send a follow-up to continue.';
}
