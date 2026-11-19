import type { Context } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import type { ManagedToolCall } from '../pi-tools.ts';
import type { ManagedRequest } from '../provider-types.ts';
import { CallReceipts, sessionState, Slot } from '../scheduler.ts';
import { autoAssessmentContext } from './auto-context.ts';
import { assessManagedTool } from './auto-provider.ts';

type Decision = 'allow' | 'ask' | 'deny';
type Assessment = Decision | 'budget_exhausted';

export type ManagedToolEvaluation = {
  readonly evaluated_permission: Decision;
  readonly evaluation:
    | { readonly type: 'always_allow' | 'always_ask' }
    | {
        readonly type: 'auto';
        readonly evaluated_permission: {
          readonly type: Decision;
          readonly reason_code?: 'high_risk' | 'indeterminate';
        };
      };
};

export type ManagedToolEvaluator = (call: ManagedToolCall, context: Context) => Promise<ManagedToolEvaluation | null>;

type Evaluate = {
  readonly harness: Harness;
  readonly call: ManagedToolCall;
  readonly context: Context;
  readonly provider: ManagedRequest;
};

function autoEvaluation(decision: Assessment): ManagedToolEvaluation {
  switch (decision) {
    case 'allow':
      return { evaluated_permission: 'allow', evaluation: { type: 'auto', evaluated_permission: { type: 'allow' } } };
    case 'budget_exhausted':
      return {
        evaluated_permission: 'deny',
        evaluation: { type: 'auto', evaluated_permission: { type: 'deny', reason_code: 'indeterminate' } },
      };
    case 'deny':
      return {
        evaluated_permission: 'deny',
        evaluation: { type: 'auto', evaluated_permission: { type: 'deny', reason_code: 'high_risk' } },
      };
    case 'ask':
      return {
        evaluated_permission: 'ask',
        evaluation: { type: 'auto', evaluated_permission: { type: 'ask', reason_code: 'indeterminate' } },
      };
  }
}

async function evaluateAuto({ harness, call, provider, context }: Evaluate): Promise<ManagedToolEvaluation> {
  const key = JSON.stringify([call.sessionId, 'native', call.nativeId]);

  const claim = await harness.commit(async (transaction) => {
    const pointer = await transaction.doc(CallReceipts, key, null);

    // An interrupted classification has uncertain upstream usage. Replay asks once instead of buying another decision.
    if (pointer.assessment === 'assessing') {
      pointer.assessment = 'ask';
    }

    if (pointer.assessment !== undefined) {
      return { action: 'reuse', decision: pointer.assessment } as const;
    }

    const state = await sessionState(transaction, call.sessionId);
    const slot = await transaction.doc(Slot);

    const isRunning = state.activeEvent !== null && state.interrupt === null && !state.isArchived;

    if (slot.owner !== state.id || !isRunning || state.waiting !== null) {
      throw new Error('The active agent no longer owns the permission assessment.');
    }

    pointer.assessment = 'assessing';

    return { action: 'assess', isPrimary: state.publicSessionId === state.id } as const;
  }, context);

  if (claim.action === 'reuse') {
    return autoEvaluation(claim.decision);
  }

  const input = await autoAssessmentContext(harness, call, claim.isPrimary);
  let decision: Assessment = 'ask';

  if (input !== null) {
    decision = await assessManagedTool(provider, input, context.abortSignal);
  }

  const recorded = await harness.commit(async (transaction) => {
    const pointer = await transaction.doc(CallReceipts, key, null);

    if (pointer.assessment === 'assessing') {
      pointer.assessment = decision;
    }

    return pointer.assessment ?? 'ask';
  }, context);

  return autoEvaluation(recorded);
}

export async function managedToolPermission(input: Evaluate): Promise<ManagedToolEvaluation | null> {
  switch (input.call.policy) {
    case null:
      return null;
    case 'always_allow':
      return { evaluated_permission: 'allow', evaluation: { type: 'always_allow' } };
    case 'always_ask':
      return { evaluated_permission: 'ask', evaluation: { type: 'always_ask' } };
    case 'auto':
      return await evaluateAuto(input);
  }
}
