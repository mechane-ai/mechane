import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { acceptInputs } from './admission.ts';
import type { ManagedAgentEngine } from './engine.ts';
import { indexedEvents } from './event-log/collections.ts';
import type { ManagedWorkerLease } from './protocol.ts';
import { CallReceipts, Sessions } from './scheduler.ts';
import { closeWorkerExposure, exposedWorkerCall } from './worker-exposure.ts';

const LossReceipts = defineDocFamily<{ readonly offset: number | null }, null>({
  kind: 'managed.worker-loss',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ offset: null }),
});

const uncertainEffect =
  'The sandbox worker lost its lease before returning a result. This tool may already have acted. Verify the external state before deciding whether to retry.';

function uncertainResult(kind: string, id: string) {
  const output = { is_error: true, content: [{ type: 'text' as const, text: uncertainEffect }] };

  switch (kind) {
    case 'custom':
      return { type: 'user.custom_tool_result' as const, custom_tool_use_id: id, ...output };
    case 'worker':
      return { type: 'user.tool_result' as const, tool_use_id: id, ...output };
    default:
      return null;
  }
}

export async function clearLostWorkerCall(transaction: Tx, input: ManagedWorkerLease, exposedId: string | null) {
  const key = JSON.stringify([input.sessionId, input.leaseId]);
  const loss = await transaction.doc(LossReceipts, key, null);

  if (loss.offset !== null) {
    return { changed: false, offset: loss.offset };
  }

  const session = await transaction.doc(Sessions, input.sessionId, null);
  let hasChanged = false;

  if (!session.isArchived && session.waiting !== null && session.waiting === exposedId) {
    const useId = session.waiting;
    const eventKey = JSON.stringify([input.sessionId, useId]);
    const call = await transaction.doc(CallReceipts, eventKey, null);

    const result = uncertainResult(call.nativeKind, useId);

    if (call.stage === 'result' && result !== null) {
      await acceptInputs(transaction, { sessionId: input.sessionId, isBudgetReached: session.isBudgetReached }, [
        result,
      ]);

      hasChanged = true;
    }
  }

  loss.offset = await indexedEvents(input.sessionId, null, 'processed').countInTransaction(transaction);

  return { changed: hasChanged, offset: loss.offset };
}

export async function recoverLocalWorkerLease(engine: ManagedAgentEngine, input: ManagedWorkerLease): Promise<void> {
  // The same lost lease can be recovered again after the actor commit but before the queue records its acknowledgment.
  const { changed } = await engine.harness.commit(async (transaction) => {
    await closeWorkerExposure(transaction, input);

    const session = await transaction.doc(Sessions, input.sessionId, null);
    const exposedId = await exposedWorkerCall(transaction, input, session.waiting);

    return await clearLostWorkerCall(transaction, input, exposedId);
  }, BACKGROUND_CONTEXT);

  if (changed) {
    engine.options.wake();
  }
}
