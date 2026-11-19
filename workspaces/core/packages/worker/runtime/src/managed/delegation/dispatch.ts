import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { sessionEvents } from '../event-log/payload-storage.ts';
import { failManagedRequest, ManagedRuntimeError } from '../failure.ts';
import type { ManagedDelegationPreview } from '../preview-coordinates.ts';
import type { ManagedEvent, ManagedSessionState, ManagedWireObject } from '../protocol.ts';
import { hasProjectedBudgetPause, relayChildBudget } from './budget-update.ts';
import { stillWaitingForClient } from './client-wait.ts';
import { notifyCoordinator, rejectDelegationOpen } from './completion.ts';
import { hasPendingFollowup } from './followup-fence.ts';
import { acknowledgeChildInput } from './inputs.ts';
import { projectDelegatedEvent } from './projection.ts';
import type {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationLeaseLoss,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationPage,
  ManagedDelegationRead,
  ManagedDelegationSend,
} from './protocol.ts';
import { ActiveChildren, Children, DispatchCursor, pendingInputs } from './records.ts';
import type { Child, PendingChildInput } from './records.ts';

export type DelegationTarget = {
  readonly delegatePreviews: (input: ManagedDelegationPreview & { readonly signal?: AbortSignal }) => Promise<Response>;
  readonly delegateLoseWorkerLease: (input: ManagedDelegationLeaseLoss) => Promise<number>;
  readonly delegateUpdateBudget: (input: ManagedDelegationBudgetUpdate) => Promise<null>;
  readonly delegateStop: (origin: ManagedDelegationOrigin) => Promise<boolean>;
  readonly delegateDelete: (origin: ManagedDelegationOrigin) => Promise<boolean>;
  readonly delegateOpen: (input: ManagedDelegationOpen) => Promise<ManagedSessionState>;
  readonly delegateRead: (input: ManagedDelegationRead) => Promise<ManagedDelegationPage>;
  readonly delegateSend: (input: ManagedDelegationSend) => Promise<ReadonlyArray<ManagedEvent>>;
};

export type ResolveDelegationTarget = (agentId: string) => DelegationTarget;

type DispatchOwner = { readonly harness: Harness; readonly target: ResolveDelegationTarget };

const permanentRejections: ReadonlySet<number> = new Set([
  HttpStatusCode.BadRequest,
  HttpStatusCode.Forbidden,
  HttpStatusCode.NotFound,
  HttpStatusCode.Conflict,
]);

const resumedEvents: ReadonlySet<string> = new Set(['session.status_running', 'agent.thread_message_received']);
const retiredStates: ReadonlySet<string> = new Set(['delete', 'stopped']);
const childBatch = 16;
const inputBatch = 32;
const refreshMs = 1000;

async function loadChildDelivery(
  harness: Harness,
  origin: ManagedDelegationOrigin,
  receipt: PendingChildInput,
): Promise<ManagedWireObject> {
  if (receipt.isBroadcast) {
    return { type: 'user.interrupt' };
  }

  const row = await sessionEvents(origin.sessionId).get(harness, receipt.deliveryId);

  if (row === undefined || row.threadId !== origin.threadId || row.event.type !== receipt.eventType) {
    failManagedRequest(HttpStatusCode.InternalServerError, 'A delegated input lost its canonical event');
  }

  const { id: _id, processed_at: _processedAt, session_thread_id: _threadId, ...event } = row.event;

  return event;
}

async function relayInputs(owner: DispatchOwner, child: Child, target: DelegationTarget) {
  const threadId = child.origin.threadId;
  const pending = await pendingInputs(threadId).page(owner.harness, { maxRows: inputBatch });

  for (const receipt of pending.items) {
    const { deliveryId } = receipt;
    const event = await loadChildDelivery(owner.harness, child.origin, receipt);
    const [acknowledged] = await target.delegateSend({ origin: child.origin, deliveryId, events: [event] });

    if (acknowledged === undefined) {
      failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated thread did not acknowledge its input');
    }

    await owner.harness.commit(
      (transaction) => acknowledgeChildInput(transaction, { threadId, deliveryId }, acknowledged),
      context,
    );
  }
}

export async function applyPage(transaction: Tx, before: Child, page: ManagedDelegationPage) {
  const { origin, parentName, agentName } = before;
  const child = await Children.read(transaction, origin.threadId);

  if (child === undefined || child.retirement !== 'live' || child.offset !== before.offset) {
    return;
  }

  if (page.offset !== before.offset + page.data.length) {
    failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated thread returned a discontinuous event page');
  }

  let isSettled = false;

  for (const event of page.data) {
    const deliveryId = page.deliveries?.[event.id];

    if (deliveryId !== undefined) {
      await acknowledgeChildInput(transaction, { threadId: origin.threadId, deliveryId }, event);
    }

    const projected = await projectDelegatedEvent(transaction, { ...origin, parentName, agentName }, event);
    const inputId = projected.reportEventId ?? projected.failureEventId;

    if (inputId !== undefined) {
      await notifyCoordinator(transaction, origin.sessionId, inputId);
    }

    if (resumedEvents.has(event.type)) {
      isSettled = false;
    }

    if (projected.isFinished === true || projected.isInterrupted === true) {
      isSettled = true;
    }
  }

  await Children.put(transaction, origin.threadId, { ...child, offset: page.offset });

  if (child.recoveryRevision !== before.recoveryRevision || (child.pendingBudgetRevision ?? 0) > 0) {
    return;
  }

  const isWaiting = await stillWaitingForClient(transaction, child, page.waitingForClientToolUseId);

  const isBudgetPaused = page.isBudgetPaused === true && (await hasProjectedBudgetPause(transaction, child));

  if (!isSettled && !isWaiting && !isBudgetPaused) {
    return;
  }

  if (
    !(await hasPendingFollowup(transaction, origin.threadId)) &&
    (await pendingInputs(origin.threadId).countInTransaction(transaction)) === 0
  ) {
    await ActiveChildren.remove(transaction, origin.threadId);
  }
}

async function advance(owner: DispatchOwner, threadId: string): Promise<void> {
  const child = await Children.get(owner.harness, threadId);

  if (child === undefined) {
    failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated thread lost its execution binding');
  }

  if (retiredStates.has(child.retirement)) {
    return;
  }

  const target = owner.target(child.origin.childAgentId);

  if (child.retirement === 'stop') {
    if (!(await target.delegateStop(child.origin))) {
      failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated thread has not acknowledged stopping');
    }

    await owner.harness.commit(async (transaction) => {
      const current = await Children.read(transaction, threadId);

      if (current?.retirement !== 'stop') {
        return;
      }

      await Children.put(transaction, threadId, { ...current, retirement: 'stopped' });
      await ActiveChildren.remove(transaction, threadId);
    }, context);

    return;
  }

  if (!child.isOpened) {
    try {
      await target.delegateOpen({ origin: child.origin, session: child.open });
    } catch (error) {
      if (!(error instanceof ManagedRuntimeError) || !permanentRejections.has(error.status)) {
        throw error;
      }

      await owner.harness.commit((transaction) => rejectDelegationOpen(transaction, child, error.status), context);

      return;
    }

    await owner.harness.commit(async (transaction) => {
      const current = await Children.read(transaction, threadId);

      if (current !== undefined && !current.isOpened) {
        await Children.put(transaction, threadId, { ...current, isOpened: true });
      }
    }, context);
  }

  await relayChildBudget(owner.harness, { child, send: target.delegateUpdateBudget });
  await relayInputs(owner, child, target);

  const page = await target.delegateRead({ origin: child.origin, offset: child.offset });

  if (page.data.length > 0 || page.waitingForClientToolUseId !== undefined || page.isBudgetPaused === true) {
    await owner.harness.commit((transaction) => applyPage(transaction, child, page), context);
  }
}

export async function advanceDelegations(owner: DispatchOwner): Promise<number | null> {
  const cursor = await owner.harness.snapshot(DispatchCursor, context);
  const page = await ActiveChildren.page(owner.harness, { offset: cursor?.offset ?? 0, maxRows: childBatch });

  if (page.items.length === 0 && (cursor?.offset ?? 0) === 0) {
    return null;
  }

  // Advance the scan even when one remote identity is unavailable.
  await owner.harness.commit(async (transaction) => {
    const next = await transaction.doc(DispatchCursor);
    next.offset = 0;

    if (page.hasMore) {
      next.offset = page.nextOffset;
    }
  }, context);

  const settled = await Promise.allSettled(page.items.map((id) => advance(owner, id)));

  for (const result of settled) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }

  return Date.now() + refreshMs;
}
