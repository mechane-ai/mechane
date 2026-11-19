import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { actorRecordCollection } from '../actor/record-store.ts';
import { pauseManagedBudget } from './budget-resume.ts';
import type { ManagedInputEvent } from './event-log/inputs.ts';
import { appendManagedEvent, processManagedEvent, readManagedEvent } from './event-log/write.ts';
import { failManagedRequest } from './failure.ts';
import { transition } from './lifecycle.ts';
import { recordManagedOutcomeEvidence } from './outcomes.ts';
import type { ManagedEvent } from './protocol.ts';
import { CallReceipts, enqueue, sessionState } from './scheduler.ts';

export type AdmissionSession = Awaited<ReturnType<typeof sessionState>>;

type Reply = Extract<
  ManagedInputEvent,
  { readonly type: 'user.tool_confirmation' | 'user.tool_result' | 'user.custom_tool_result' }
>;

function callKey(id: string, toolId: string) {
  return JSON.stringify([id, toolId]);
}

export async function pendingManagedCall(transaction: Tx, state: AdmissionSession): Promise<boolean> {
  if (state.waiting === null) {
    return false;
  }

  const receipt = await transaction.doc(CallReceipts, callKey(state.id, state.waiting), null);

  return receipt.stage !== 'complete';
}

export async function acceptManagedToolReply(
  transaction: Tx,
  { state, isBudgetReached }: { readonly state: AdmissionSession; readonly isBudgetReached: boolean },
  event: Reply,
): Promise<ManagedEvent> {
  let id = '';

  if (event.type === 'user.custom_tool_result') {
    id = event.custom_tool_use_id;
  } else {
    id = event.tool_use_id;
  }

  const call = await transaction.doc(CallReceipts, callKey(state.id, id), null);

  if (call.eventId === '' || call.eventId !== id) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Unknown tool call in this session');
  }

  if (event.type === 'user.custom_tool_result' && call.nativeKind !== 'custom') {
    failManagedRequest(HttpStatusCode.BadRequest, 'The result does not refer to a custom tool call');
  }

  if (event.type === 'user.tool_result' && call.nativeKind !== 'worker') {
    failManagedRequest(HttpStatusCode.BadRequest, 'This tool does not accept a worker result');
  }

  if (event.type !== 'user.tool_confirmation' && call.stage === 'complete') {
    const prior = await readManagedEvent(transaction, state.id, call.resultId);

    if (prior?.type === event.type) {
      return prior;
    }

    failManagedRequest(HttpStatusCode.BadRequest, 'The tool call was closed before this result');
  }

  if (state.waiting !== id) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The tool call is no longer pending');
  }

  const isConfirmation = event.type === 'user.tool_confirmation';

  if (isConfirmation !== (call.stage === 'approval') || call.stage === 'complete') {
    failManagedRequest(HttpStatusCode.BadRequest, 'Unexpected response for this stage of the tool call');
  }

  const admitted = await appendManagedEvent(transaction, { sessionId: state.id }, event);

  if (event.type === 'user.tool_confirmation' && event.result === 'allow') {
    call.stage = 'result';

    await processManagedEvent(transaction, state.id, admitted.id);
    await transition(transaction, { sessionId: state.id, status: 'running' });

    if (call.nativeKind === 'mcp') {
      await enqueue(transaction, state.id);
    }

    return admitted;
  }

  call.stage = 'complete';
  call.resultId = admitted.id;

  if (isConfirmation) {
    await processManagedEvent(transaction, state.id, admitted.id);
  }

  if (event.type === 'user.tool_result') {
    const origin = await readManagedEvent(transaction, state.id, id);

    if (origin !== undefined) {
      await recordManagedOutcomeEvidence(transaction, state.id, { call: origin, result: admitted });
    }
  }

  if (isBudgetReached && state.interrupt === null) {
    await pauseManagedBudget(transaction, state.id);
  } else {
    await transition(transaction, { sessionId: state.id, status: 'running' });
    await enqueue(transaction, state.id);
  }

  return admitted;
}

function interrupts(id: string) {
  return actorRecordCollection(`managed-interrupts:${id}`, Schema.String);
}

export async function pendingExternalEffect(
  transaction: Tx,
  state: AdmissionSession,
): Promise<'worker' | 'mcp' | null> {
  if (state.waiting === null) {
    return null;
  }

  const call = await transaction.doc(CallReceipts, callKey(state.id, state.waiting), null);

  if (call.stage !== 'result') {
    return null;
  }

  if (call.nativeKind === 'worker') {
    return 'worker';
  }

  if (call.nativeKind === 'mcp' && call.hasStartedDispatch === true) {
    return 'mcp';
  }

  return null;
}

export async function finishManagedInterrupt(transaction: Tx, id: string): Promise<void> {
  const events = interrupts(id);

  for (const eventId of await events.allInTransaction(transaction)) {
    await processManagedEvent(transaction, id, eventId);
  }

  await events.retire(transaction);
}

export async function interruptManagedTurn(
  transaction: Tx,
  state: AdmissionSession,
  event: Extract<ManagedInputEvent, { readonly type: 'user.interrupt' }>,
): Promise<ManagedEvent> {
  if (
    event.session_thread_id !== null &&
    event.session_thread_id !== undefined &&
    event.session_thread_id !== state.threadId
  ) {
    failManagedRequest(HttpStatusCode.NotFound, 'Thread not found');
  }

  const admitted = await appendManagedEvent(transaction, { sessionId: state.id }, event);

  if (state.activeEvent === null && state.pendingHead === state.pendingTail) {
    await processManagedEvent(transaction, state.id, admitted.id);

    return admitted;
  }

  await interrupts(state.id).put(transaction, admitted.id, admitted.id);

  const session = await sessionState(transaction, state.id);
  session.interrupt ??= admitted.id;

  // A dispatched worker or MCP call owns its result, even if its caller requests an interrupt.
  if ((await pendingExternalEffect(transaction, state)) !== null) {
    return admitted;
  }

  if (state.waiting !== null) {
    const call = await transaction.doc(CallReceipts, callKey(state.id, state.waiting), null);

    if (call.stage !== 'complete') {
      const result = await appendManagedEvent(
        transaction,
        { sessionId: state.id, stableKey: `interrupt-call:${call.eventId}` },
        {
          ...interruptedResult(call.nativeKind, call.eventId),
          is_error: true,
          content: [{ type: 'text', text: 'Tool execution was interrupted before completion. Please retry.' }],
        },
      );

      call.resultId = result.id;
      call.stage = 'complete';
    }
  }

  await transition(transaction, { sessionId: state.id, status: 'running' });
  await enqueue(transaction, state.id);

  return admitted;
}

function interruptedResult(kind: string, id: string) {
  switch (kind) {
    case 'mcp':
      return { type: 'agent.mcp_tool_result', mcp_tool_use_id: id };
    case 'custom':
      return { type: 'user.custom_tool_result', custom_tool_use_id: id };
    default:
      return { type: 'user.tool_result', tool_use_id: id };
  }
}
