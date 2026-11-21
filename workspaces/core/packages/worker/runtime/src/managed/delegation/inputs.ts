import type { Tx } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { actorRecordCollection } from '../../actor/record-store.ts';
import type { ManagedInputEvent } from '../event-log/inputs.ts';
import { sessionEvents } from '../event-log/payload-storage.ts';
import { appendManagedEvent, processManagedEvent, readManagedEvent } from '../event-log/write.ts';
import type { ManagedEvent, ManagedSessionThreadReference } from '../protocol.ts';
import { liveThreadIds, requiredThread } from '../thread-records.ts';
import type { ThreadRecord } from '../thread-records.ts';
import { observeFollowup } from './followup-fence.ts';
import type { PendingChildInput } from './records.ts';
import { ActiveChildren, Children, pendingInputs } from './records.ts';

type ChildDelivery = { readonly threadId: string; readonly deliveryId: string };

type Reply = Extract<
  ManagedInputEvent,
  { readonly type: 'user.tool_result' | 'user.custom_tool_result' | 'user.tool_confirmation' }
>;

const userResultEvents: ReadonlySet<string> = new Set(['user.custom_tool_result', 'user.tool_result']);

const Call = Schema.Struct({
  isComplete: Schema.Boolean,
  confirmation: Schema.NullOr(Schema.String),
  result: Schema.NullOr(Schema.String),
});

function calls(sessionId: string) {
  return actorRecordCollection(`managed.delegated-calls:${sessionId}`, Call);
}

export function pendingChildCalls(sessionId: string) {
  return actorRecordCollection(`managed.delegated-pending-call:${sessionId}`, Schema.String);
}

function echoes(sessionId: string) {
  return actorRecordCollection(`managed.delegated-echo:${sessionId}`, Schema.NullOr(Schema.String));
}

function invalid(message: string): never {
  return failManagedRequest(HttpStatusCode.BadRequest, message);
}

export async function observeChildCall(
  transaction: Tx,
  { sessionId, threadId }: ManagedSessionThreadReference,
  event: ManagedEvent,
) {
  const receipts = calls(sessionId);

  if ((await receipts.read(transaction, event.id)) !== undefined) {
    return;
  }

  const isDenied = event['evaluated_permission'] === 'deny';

  await receipts.put(transaction, event.id, { isComplete: isDenied, confirmation: null, result: null });

  if (!isDenied) {
    await pendingChildCalls(sessionId).put(transaction, threadId, event.id);
  }
}

export async function observeChildResult(
  transaction: Tx,
  { sessionId, threadId }: ManagedSessionThreadReference,
  event: ManagedEvent,
) {
  const id = event['tool_use_id'] ?? event['mcp_tool_use_id'] ?? event['custom_tool_use_id'];

  if (typeof id !== 'string') {
    return;
  }

  const current = pendingChildCalls(sessionId);

  if ((await current.read(transaction, threadId)) !== id) {
    return;
  }

  const receipts = calls(sessionId);
  const call = await receipts.read(transaction, id);

  if (call !== undefined) {
    await receipts.put(transaction, id, { ...call, isComplete: true, result: call.result ?? event.id });
  }

  await current.remove(transaction, threadId);
}

async function queueChildDelivery(transaction: Tx, threadId: string, input: PendingChildInput) {
  await pendingInputs(threadId).put(transaction, input.deliveryId, input);
  await ActiveChildren.put(transaction, threadId, threadId);
}

export async function enqueueChild(transaction: Tx, threadId: string, event: ManagedEvent) {
  await queueChildDelivery(transaction, threadId, { deliveryId: event.id, eventType: event.type, isBroadcast: false });
}

async function interruptChild(
  transaction: Tx,
  thread: ThreadRecord,
  isTargeted: boolean,
): Promise<ManagedEvent | null> {
  if (thread.parentId === null) {
    return null;
  }

  if (thread.archivedAt !== null || thread.status === 'terminated') {
    if (isTargeted) {
      invalid('Cannot interrupt a terminated thread');
    }

    return null;
  }

  const fields = { type: 'user.interrupt', session_thread_id: thread.id };
  const isIdle = thread.status === 'idle' && thread.reason?.['type'] !== 'requires_action';

  if (isTargeted) {
    const sessionId = thread.sessionId;
    const canonical = await appendManagedEvent(transaction, { sessionId, threadId: thread.id }, fields);

    if (isIdle) {
      return { ...canonical, processed_at: await processManagedEvent(transaction, sessionId, canonical.id) };
    }

    await deliverInterrupt(transaction, thread, {
      deliveryId: canonical.id,
      eventType: canonical.type,
      isBroadcast: false,
    });

    return canonical;
  }

  if (!isIdle) {
    // The primary records the broadcast. Each participating child gets its own private relay receipt.
    const id = `sevt_${crypto.randomUUID().replaceAll('-', '')}`;

    await deliverInterrupt(transaction, thread, { deliveryId: id, eventType: fields.type, isBroadcast: true });
  }

  return null;
}

async function deliverInterrupt(transaction: Tx, thread: ThreadRecord, input: PendingChildInput) {
  const { sessionId } = thread;
  const pending = pendingChildCalls(sessionId);
  const callId = await pending.read(transaction, thread.id);

  if (callId !== undefined) {
    const call = await calls(sessionId).read(transaction, callId);
    const use = await readManagedEvent(transaction, sessionId, callId);

    const isAwaitingWorker =
      use?.type === 'agent.tool_use' &&
      (use['evaluated_permission'] !== 'ask' || typeof call?.confirmation === 'string');

    if (!isAwaitingWorker) {
      if (call !== undefined) {
        await calls(sessionId).put(transaction, callId, { ...call, isComplete: true });
      }

      await pending.remove(transaction, thread.id);
    }
  }

  await queueChildDelivery(transaction, thread.id, input);
}

function replyUseId(event: Reply) {
  if (event.type === 'user.custom_tool_result') {
    return event.custom_tool_use_id;
  }

  return event.tool_use_id;
}

async function acceptChildReply(transaction: Tx, sessionId: string, event: Reply): Promise<ManagedEvent | null> {
  const id = replyUseId(event);
  const row = await sessionEvents(sessionId).describe(transaction, id);

  if (row === undefined || row.threadId === null) {
    return null;
  }

  const threadId = row.threadId;
  const thread = await requiredThread(transaction, sessionId, threadId);

  if (thread.archivedAt !== null || thread.status === 'terminated') {
    invalid('The delegated thread has ended');
  }

  const receipts = calls(sessionId);
  const call = await receipts.read(transaction, id);

  if (call === undefined) {
    invalid('The event does not identify a delegated tool call');
  }

  const use = row.event;

  if (event.type === 'user.custom_tool_result' && use.type !== 'agent.custom_tool_use') {
    invalid('Expected a custom tool call');
  }

  if (event.type === 'user.tool_result' && use.type !== 'agent.tool_use') {
    invalid('Expected a worker tool call');
  }

  const isConfirmation = event.type === 'user.tool_confirmation';
  let priorId = call.result;

  if (isConfirmation) {
    priorId = call.confirmation;
  }

  if (priorId !== null) {
    const prior = await readManagedEvent(transaction, sessionId, priorId);

    if (prior?.type === event.type && (!isConfirmation || event.result === prior['result'])) {
      return prior;
    }

    invalid('This delegated call has already been resolved');
  }

  if (call.isComplete || (await pendingChildCalls(sessionId).read(transaction, threadId)) !== id) {
    invalid('The delegated call is no longer pending');
  }

  const requiresConfirmation = use['evaluated_permission'] === 'ask' && call.confirmation === null;

  if (requiresConfirmation !== isConfirmation) {
    invalid('Unexpected response for this stage of the delegated call');
  }

  const admitted = await appendManagedEvent(transaction, { sessionId, threadId }, event);
  const isComplete = !isConfirmation || event.result === 'deny';

  if (isConfirmation) {
    await receipts.put(transaction, id, { ...call, isComplete, confirmation: admitted.id });
  } else {
    await receipts.put(transaction, id, { ...call, isComplete, result: admitted.id });
  }

  if (isComplete) {
    await pendingChildCalls(sessionId).remove(transaction, threadId);
  }

  await enqueueChild(transaction, threadId, admitted);

  return admitted;
}

export async function admitChildInput(
  transaction: Tx,
  sessionId: string,
  event: ManagedInputEvent,
): Promise<ManagedEvent | null> {
  switch (event.type) {
    case 'user.interrupt':
      if (typeof event.session_thread_id === 'string') {
        return await interruptChild(
          transaction,
          await requiredThread(transaction, sessionId, event.session_thread_id),
          true,
        );
      }

      for (const id of await liveThreadIds(sessionId).allInTransaction(transaction)) {
        await interruptChild(transaction, await requiredThread(transaction, sessionId, id), false);
      }

      return null;
    case 'user.tool_confirmation':
    case 'user.custom_tool_result':
    case 'user.tool_result':
      return await acceptChildReply(transaction, sessionId, event);
    case 'user.message':
    case 'system.message':
    case 'user.define_outcome':
      return null;
  }
}

export async function acknowledgeChildInput(
  transaction: Tx,
  { threadId, deliveryId }: ChildDelivery,
  source: ManagedEvent,
): Promise<void> {
  const child = await Children.read(transaction, threadId);

  if (child === undefined) {
    failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated input lost its owner');
  }

  const sessionId = child.origin.sessionId;
  const outbox = await pendingInputs(threadId).read(transaction, deliveryId);
  const map = echoes(sessionId);
  const key = JSON.stringify([threadId, source.id]);

  if (outbox === undefined) {
    if ((await map.read(transaction, key)) === undefined) {
      failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated acknowledgement has no delivery');
    }

    return;
  }

  if (outbox.eventType !== source.type) {
    failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated acknowledgement does not match its delivery');
  }

  if (outbox.isBroadcast) {
    await map.put(transaction, key, null);
  } else {
    await map.put(transaction, key, deliveryId);

    if (source.processed_at !== null) {
      await processManagedEvent(transaction, sessionId, deliveryId);
    }
  }

  await pendingInputs(threadId).remove(transaction, deliveryId);
}

export async function processChildEcho(
  transaction: Tx,
  { sessionId, threadId }: ManagedSessionThreadReference,
  source: ManagedEvent,
): Promise<boolean> {
  const mapped = await echoes(sessionId).read(transaction, JSON.stringify([threadId, source.id]));

  if (mapped === undefined) {
    if (userResultEvents.has(source.type)) {
      await observeChildResult(transaction, { sessionId, threadId }, source);
    }

    return false;
  }

  if (mapped !== null && source.type === 'agent.thread_message_received') {
    await observeFollowup(transaction, threadId, mapped);
  }

  if (mapped !== null && source.processed_at !== null) {
    await processManagedEvent(transaction, sessionId, mapped);
  }

  return true;
}

export async function eraseChildInputReceipts(transaction: Tx, sessionId: string): Promise<void> {
  await calls(sessionId).retire(transaction);
  await pendingChildCalls(sessionId).retire(transaction);
  await echoes(sessionId).retire(transaction);
}
