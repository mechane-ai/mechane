import type { Tx } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { admitChildInput } from './delegation/inputs.ts';
import { validateManagedInputs } from './event-log/inputs.ts';
import type { ManagedInputEvent } from './event-log/inputs.ts';
import { appendManagedEvent, processManagedEvent } from './event-log/write.ts';
import { acceptManagedToolReply, interruptManagedTurn, pendingManagedCall } from './input-turns.ts';
import type { AdmissionSession } from './input-turns.ts';
import { transition } from './lifecycle.ts';
import { defineManagedOutcome, interruptManagedOutcome, validateManagedOutcome } from './outcomes.ts';
import type { ManagedEvent } from './protocol.ts';
import { ensureManagedSessionAvailable, queueInput, sessionState } from './scheduler.ts';
import { applyManagedSystemMessage, validateManagedSystemMessages } from './system-message.ts';
import { readManagedSessionState } from './thread-state.ts';
import { managedInputContent, managedResultContent } from './tool-content.ts';
import { assertWorkerResultExposure } from './worker-exposure.ts';

export function preflightManagedEvents(raw: unknown, isInitial = false) {
  const inputs = validateManagedInputs(raw, isInitial);

  for (const event of inputs) {
    switch (event.type) {
      case 'user.message':
        managedInputContent(event);

        break;
      case 'user.tool_result':
      case 'user.custom_tool_result':
        managedResultContent(event);

        break;
      case 'user.define_outcome':
        validateManagedOutcome(event);

        break;
      case 'system.message':
      case 'user.interrupt':
      case 'user.tool_confirmation':
        break;
    }
  }

  return inputs;
}

export async function acceptInputs(
  transaction: Tx,
  {
    sessionId,
    threadId,
    workerLeaseId,
    isBudgetReached = false,
  }: {
    readonly sessionId: string;
    readonly threadId?: string | undefined;
    readonly workerLeaseId?: string | undefined;
    readonly isBudgetReached?: boolean | undefined;
  },
  inputs: ReadonlyArray<ManagedInputEvent>,
) {
  await ensureManagedSessionAvailable(transaction, sessionId);

  if (workerLeaseId !== undefined) {
    await assertWorkerResultExposure(transaction, { sessionId, leaseId: workerLeaseId }, inputs);
  }

  const state = await sessionState(transaction, sessionId, threadId);

  if (state.isArchived) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The session has ended');
  }

  if (state.status === 'terminated') {
    const activity = await readManagedSessionState(transaction, sessionId);

    if (activity.status === 'terminated') {
      failManagedRequest(HttpStatusCode.BadRequest, 'The session has ended');
    }
  }

  if (inputs.some((event) => event.type === 'system.message')) {
    const activity = await readManagedSessionState(transaction, sessionId);
    const pending = activity.stop_reason?.['event_ids'];
    const pendingToolIds = new Set<string>();

    if (activity.stop_reason?.['type'] === 'requires_action' && Array.isArray(pending)) {
      for (const id of pending) {
        if (typeof id === 'string') {
          pendingToolIds.add(id);
        }
      }
    }

    validateManagedSystemMessages(inputs, {
      model: state.model,
      pendingToolIds,
      isPrimary: state.id === state.publicSessionId,
    });
  }

  const batch: Array<ManagedEvent> = [];

  for (const event of inputs) {
    const admitted = await admit(transaction, { state, isBudgetReached }, event);

    if (admitted !== null) {
      batch.push(admitted);
    }
  }

  return batch;
}

const workInputs: ReadonlySet<ManagedInputEvent['type']> = new Set([
  'user.message',
  'system.message',
  'user.define_outcome',
]);

type Admission = { readonly state: AdmissionSession; readonly isBudgetReached: boolean };

async function admit(transaction: Tx, context: Admission, event: ManagedInputEvent) {
  const { state, isBudgetReached } = context;

  if (isBudgetReached && workInputs.has(event.type)) {
    failManagedRequest(
      HttpStatusCode.BadRequest,
      'The session has reached its budget. It accepts only user.tool_confirmation, user.tool_result, user.custom_tool_result, and user.interrupt',
    );
  }

  if (isBudgetReached && event.type === 'user.interrupt') {
    const activity = await readManagedSessionState(transaction, state.id);

    if (activity.status === 'idle' && activity.stop_reason?.['type'] === 'budget_reached') {
      return null;
    }
  }

  if (state.id === state.publicSessionId) {
    const child = await admitChildInput(transaction, state.id, event);

    if (child !== null) {
      return child;
    }
  }

  if (state.status === 'terminated') {
    if (
      event.type === 'user.interrupt' &&
      (event.session_thread_id === null || event.session_thread_id === undefined)
    ) {
      const broadcast = await appendManagedEvent(transaction, { sessionId: state.id }, event);

      return { ...broadcast, processed_at: await processManagedEvent(transaction, state.id, broadcast.id) };
    }

    failManagedRequest(HttpStatusCode.BadRequest, 'The primary thread has ended');
  }

  return await acceptPrimaryInput(transaction, context, event);
}

async function acceptPrimaryInput(
  transaction: Tx,
  { state, isBudgetReached }: Admission,
  event: ManagedInputEvent,
): Promise<ManagedEvent> {
  switch (event.type) {
    case 'user.define_outcome':
      return await defineManagedOutcome(transaction, state.id, event);
    case 'user.tool_confirmation':
    case 'user.tool_result':
    case 'user.custom_tool_result':
      return await acceptManagedToolReply(transaction, { state, isBudgetReached }, event);
    case 'user.interrupt':
      await interruptManagedOutcome(transaction, state.id);

      return await interruptManagedTurn(transaction, state, event);
    case 'system.message': {
      const admitted = await appendManagedEvent(transaction, { sessionId: state.id }, event);

      if (state.pendingHead === state.pendingTail && (state.waiting !== null || state.activeEvent === null)) {
        if (state.conversation === null) {
          throw new Error('Missing managed session conversation');
        }

        await applyManagedSystemMessage(transaction, state.conversation, { event: admitted });

        const processedAt = await processManagedEvent(transaction, state.id, admitted.id);

        return { ...admitted, processed_at: processedAt };
      }

      await queueInput(transaction, state.id, admitted.id);

      return admitted;
    }
    case 'user.message': {
      if (state.interrupt === null && (await pendingManagedCall(transaction, state))) {
        failManagedRequest(HttpStatusCode.BadRequest, 'Resolve the outstanding tool call before sending a message');
      }

      const admitted = await appendManagedEvent(transaction, { sessionId: state.id }, event);

      await queueInput(transaction, state.id, admitted.id);

      // An interrupt and its following message have distinct public state transitions.
      if (state.interrupt === null) {
        await transition(transaction, { sessionId: state.id, status: 'running' });
      }

      return admitted;
    }
  }
}
