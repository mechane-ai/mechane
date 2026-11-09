import type { Run } from '../domain.ts';
import type { RuntimeStore } from '../store/database.ts';
import { runFailureMessage, terminalOutcome } from './terminal-outcome.ts';
import type { RunOutcome } from './types.ts';

const TERMINAL_RUN_STATUSES: ReadonlySet<Run['status']> = new Set(['completed', 'failed', 'cancelled']);

type StopActivationInput = {
  readonly store: RuntimeStore;
  readonly runId: string;
  readonly status: 'failed' | 'cancelled';
  readonly error?: string;
};

type StoppedActivation = { readonly run: Run; readonly outcome: RunOutcome; readonly wasFinished: boolean };

export async function stopActivation({ store, runId, status, error }: StopActivationInput): Promise<StoppedActivation> {
  const current = await store.getRun({ runId });

  if (current === null) {
    throw new Error('Run is unavailable');
  }

  if (TERMINAL_RUN_STATUSES.has(current.status)) {
    return { run: current, outcome: terminalOutcome(current), wasFinished: false };
  }

  const context = await store.getMechContext({ runId });
  const trace = await store.getRunMessages({ runId });

  const result = await store.finishActivation({
    runId,
    ...context,
    checkpointSequence: context.checkpointSequence + 1,
    traceMessages: trace.modelMessages,
    shouldContinue: false,
    status,
    error: error ?? runFailureMessage(current.failureReason),
  });

  return { run: result.run, outcome: terminalOutcome(result.run), wasFinished: true };
}
