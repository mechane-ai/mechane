import type {
  Conversation,
  EntryRecord,
  RunFailure,
  SubmissionId,
  SubmissionRecord,
  Tx,
} from '@earendil-works/pi-durable';
import { LiveDoc } from '@earendil-works/pi-durable';
import { managedModelError, parseModelRefusal } from '@mechane/model-gateway';
import { pauseManagedBudget } from './budget-resume.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { appendManagedEvent } from './event-log/write.ts';
import { finishManagedInterrupt } from './input-turns.ts';
import { transition } from './lifecycle.ts';
import { completeManagedOutcomeTurn, managedGraderHeartbeat } from './outcomes.ts';
import { readManagedAnswer } from './preview-output.ts';
import type { ManagedWireObject } from './protocol.ts';
import { ActiveNativeSessions, enqueue, release, sessionState } from './scheduler.ts';

type TurnEnd =
  | { readonly kind: 'end_turn' }
  | { readonly kind: 'interrupted' }
  | { readonly kind: 'retries_exhausted' }
  | { readonly kind: 'refusal'; readonly stopDetails: ManagedWireObject | null };

type SettledSubmission = Extract<SubmissionRecord, { readonly status: 'done' | 'unanswered' }>;
type ObservedBudget = { readonly settled: SubmissionId | null; readonly revision: number };

const DEFAULT_TURN_END = { kind: 'end_turn' } as const satisfies TurnEnd;

function idleStop(cause: TurnEnd): {
  readonly reason: 'end_turn' | 'retries_exhausted' | 'refusal';
  readonly stopDetails: ManagedWireObject | null;
} {
  if (cause.kind === 'retries_exhausted') {
    return { reason: 'retries_exhausted', stopDetails: null };
  }

  if (cause.kind === 'refusal') {
    return { reason: 'refusal', stopDetails: cause.stopDetails };
  }

  return { reason: 'end_turn', stopDetails: null };
}

export async function finishManagedTurn(
  transaction: Tx,
  sessionId: string,
  cause: TurnEnd = DEFAULT_TURN_END,
): Promise<void> {
  const state = await sessionState(transaction, sessionId);
  state.activeEvent = null;
  state.submission = null;
  state.activation = null;
  state.waiting = null;

  await release(transaction, sessionId);
  await ActiveNativeSessions.remove(transaction, sessionId);

  const hasNext = !state.isBudgetReached && state.pendingHead < state.pendingTail;

  if (!hasNext || cause.kind !== 'end_turn') {
    const { reason, stopDetails } = idleStop(cause);

    await transition(transaction, { sessionId, status: 'idle', reason: { type: reason }, stopDetails });
  }

  if (hasNext) {
    if (cause.kind !== 'end_turn') {
      await transition(transaction, { sessionId, status: 'running' });
    }

    await enqueue(transaction, sessionId);
  }
}

async function submittedAnswer(transaction: Tx, submitted: SettledSubmission): Promise<EntryRecord | undefined> {
  if (submitted.answer === undefined) {
    return undefined;
  }

  return await transaction.entry(submitted.answer);
}

async function recordCompletion(
  transaction: Tx,
  sessionId: string,
  { submitted, failure }: { readonly submitted: SettledSubmission; readonly failure: RunFailure | undefined },
): Promise<TurnEnd> {
  const state = await sessionState(transaction, sessionId);

  if (state.activeEvent === null) {
    throw new Error('Missing active input');
  }

  const header = await sessionEvents(sessionId).describe(transaction, state.activeEvent);
  const active = header?.event;

  if (active === undefined) {
    throw new Error('Missing active input');
  }

  const answer = await submittedAnswer(transaction, submitted);
  const wasInterrupted = state.interrupt !== null;
  const hasFailed = submitted.status === 'unanswered' && !wasInterrupted;

  let outcome: Parameters<typeof completeManagedOutcomeTurn>[2] = {
    active,
    answers: answer?.model?.filter((message) => message.role === 'assistant') ?? [],
    hasFailed,
    wasInterrupted,
  };

  if (answer !== undefined && active.type !== 'span.outcome_evaluation_start') {
    const published = await readManagedAnswer(transaction, sessionId, answer);
    outcome = { ...outcome, answerId: published?.id };
  }

  if (wasInterrupted) {
    await finishManagedInterrupt(transaction, sessionId);

    state.interrupt = null;
  }

  await completeManagedOutcomeTurn(transaction, sessionId, outcome);

  if (hasFailed) {
    if (failure?.reason === 'model_error') {
      const refusal = parseModelRefusal(failure.detail);

      if (refusal !== null) {
        return { kind: 'refusal', stopDetails: refusal.details };
      }
    }

    let error = {
      type: 'unknown_error',
      message: 'The model turn could not finish',
      retry_status: { type: 'exhausted' },
    };

    if (failure?.reason === 'model_error') {
      error = managedModelError(failure.detail);
    }

    await appendManagedEvent(transaction, { sessionId }, { type: 'session.error', error });

    return { kind: 'retries_exhausted' };
  }

  if (wasInterrupted) {
    return { kind: 'interrupted' };
  }

  return { kind: 'end_turn' };
}

export async function settleManagedSubmission(
  transaction: Tx,
  submissionId: SubmissionId,
  input: {
    readonly sessionId: string;
    readonly conversation: Conversation;
    readonly boundary: ObservedBudget;
    readonly isBudgetReached: boolean;
  },
): Promise<boolean> {
  const { sessionId, conversation, boundary, isBudgetReached } = input;
  const state = await sessionState(transaction, sessionId);
  const submitted = await transaction.submission(submissionId);

  if (submitted === undefined) {
    throw new Error('The native submission is missing');
  }

  switch (submitted.status) {
    case 'queued':
    case 'placed':
      await managedGraderHeartbeat(transaction, sessionId, state.activeEvent);

      return false;
    case 'done':
    case 'unanswered':
      break;
  }

  const live = await transaction.doc(LiveDoc, conversation.id);

  if (live.run !== undefined) {
    return false;
  }

  if (submissionId !== boundary.settled || state.budgetRevision !== boundary.revision) {
    return true;
  }

  if (state.interrupt === null && submitted.status === 'unanswered' && live.runFailure?.reason === 'model_error') {
    if (isBudgetReached) {
      state.submission = null;

      await pauseManagedBudget(transaction, sessionId);

      return true;
    }

    if (live.runFailure.detail === 'session_budget') {
      state.submission = await conversation.submit(transaction, { type: 'continue' });

      return true;
    }
  }

  state.isBudgetReached = isBudgetReached;
  const cause = await recordCompletion(transaction, sessionId, { submitted, failure: live.runFailure });

  await finishManagedTurn(transaction, sessionId, cause);

  return true;
}
