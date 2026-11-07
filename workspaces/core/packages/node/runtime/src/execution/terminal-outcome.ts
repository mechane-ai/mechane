import type { Run } from '../domain.ts';
import type { RuntimeStore } from '../store/database.ts';
import { runOutput } from './run-output.ts';
import type { RunOutcome } from './types.ts';

type TerminalOutcomeInput = { readonly store: RuntimeStore; readonly run: Run };

const CANCELLATION_MESSAGE =
  'This run was stopped. Cancellation does not undo completed commands or guarantee that every external command stopped. Inspect external effects before retrying.';

export async function readTerminalOutcome({ store, run }: TerminalOutcomeInput): Promise<RunOutcome> {
  switch (run.status) {
    case 'completed': {
      if (run.reply === null) {
        throw new Error('Completed run has no recorded reply');
      }

      const messages = await store.getRunMessages({ runId: run.id });
      const output = runOutput(messages.modelMessages);

      return { runId: run.id, status: 'completed', reply: run.reply, error: null, presentation: output.presentation };
    }
    case 'failed':
      return {
        runId: run.id,
        status: 'failed',
        reply: null,
        error: run.error ?? runFailureMessage(run.failureReason),
        presentation: null,
      };
    case 'cancelled':
      return { runId: run.id, status: 'cancelled', reply: null, error: CANCELLATION_MESSAGE, presentation: null };
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
