import { defineDoc, defineDocFamily } from '@earendil-works/pi-durable';
import type { ConversationId, SubmissionId, Tx } from '@earendil-works/pi-durable';
import type { ManagedEffort } from '@mechane/model-gateway';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { actorRecordSet } from '../actor/record-store.ts';

type SessionState = {
  readonly id: string;
  readonly publicSessionId: string;
  readonly threadId: string;
  readonly conversation: ConversationId | null;
  readonly retiringConversation: ConversationId | null;
  readonly runtimeMechId: string;
  readonly environmentId: string;
  readonly model: string;
  readonly speed: 'standard' | 'fast';
  readonly effort: ManagedEffort | null;
  readonly instructions: string;
  readonly coordinator: string;
  readonly tools: string;
  readonly mcpServers: string;
  readonly mcpDescriptors: string;
  readonly mcpCatalogKey: string;
  readonly mutationId: string | null;
  readonly status: 'idle' | 'running' | 'terminated';
  readonly stopReason: string | null;
  readonly isBudgetReached: boolean;
  readonly budgetRevision: number;
  readonly isArchived: boolean;
  readonly pendingHead: number;
  readonly pendingTail: number;
  readonly isReady: boolean;
  readonly next: string | null;
  readonly activeEvent: string | null;
  readonly activation: string | null;
  readonly submission: SubmissionId | null;
  readonly waiting: string | null;
  readonly interrupt: string | null;
};

export const Sessions = defineDocFamily<SessionState, null>({
  kind: 'managed.session',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({
    id: '',
    publicSessionId: '',
    threadId: '',
    conversation: null,
    retiringConversation: null,
    runtimeMechId: '',
    environmentId: '',
    model: '',
    speed: 'standard',
    effort: null,
    instructions: '',
    coordinator: '',
    tools: '[]',
    mcpServers: '[]',
    mcpDescriptors: '[]',
    mcpCatalogKey: '',
    mutationId: null,
    status: 'idle',
    stopReason: null,
    isBudgetReached: false,
    budgetRevision: 0,
    isArchived: false,
    pendingHead: 0,
    pendingTail: 0,
    isReady: false,
    next: null,
    activeEvent: null,
    activation: null,
    submission: null,
    waiting: null,
    interrupt: null,
  }),
});

export const ActiveNativeSessions = actorRecordSet('managed.active-native');
export const DirtySessions = actorRecordSet('managed.dirty');

export const ThreadInputs = defineDocFamily<{ readonly eventId: string }, null>({
  kind: 'managed.thread-input',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ eventId: '' }),
});

export const CallReceipts = defineDocFamily<
  {
    readonly eventId: string;
    readonly resultId: string;
    readonly stage: 'approval' | 'result' | 'complete';
    readonly nativeId: string;
    readonly nativeKind: string;
    readonly hasStartedDispatch?: boolean;
    readonly nextWorkerCheckAt?: number;
    readonly assessment?: 'assessing' | 'allow' | 'ask' | 'deny' | 'budget_exhausted';
  },
  null
>({
  kind: 'managed.tool-call',
  version: 1,
  scope: 'session',
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ eventId: '', resultId: '', stage: 'result', nativeId: '', nativeKind: '' }),
});

export const Slot = defineDoc<{
  readonly owner: string | null;
  readonly epoch: number;
  readonly head: string | null;
  readonly tail: string | null;
}>({
  kind: 'managed.execution-slot',
  version: 1,
  scope: 'session',
  checkpointWhen: () => true,
  initial: () => ({ owner: null, epoch: 0, head: null, tail: null }),
});

export async function enqueue(transaction: Tx, id: string): Promise<void> {
  const state = await transaction.doc(Sessions, id, null);
  const slot = await transaction.doc(Slot);

  const isUnavailable = state.isArchived || state.mutationId !== null;

  if (state.isReady || slot.owner === id || isUnavailable) {
    return;
  }

  if (slot.tail === null) {
    slot.head = id;
  } else {
    const tail = await transaction.doc(Sessions, slot.tail, null);
    tail.next = id;
  }

  slot.tail = id;
  state.isReady = true;
}

export async function choose(transaction: Tx): Promise<string | null> {
  const slot = await transaction.doc(Slot);

  while (slot.owner === null && slot.head !== null) {
    const id = slot.head;
    const state = await transaction.doc(Sessions, id, null);
    slot.head = state.next;

    if (slot.head === null) {
      slot.tail = null;
    }

    state.next = null;
    state.isReady = false;

    if (state.status === 'running' && !state.isArchived && state.mutationId === null) {
      slot.owner = id;
      slot.epoch += 1;
    }
  }

  return slot.owner;
}

export async function sessionState(transaction: Tx, sessionId: string, threadId?: string) {
  const state = await transaction.doc(Sessions, sessionId, null);

  if (state.id === '' || (threadId !== undefined && state.threadId !== threadId)) {
    failManagedRequest(HttpStatusCode.NotFound, 'Session or thread not found');
  }

  return state;
}

export async function ensureManagedSessionAvailable(transaction: Tx, sessionId: string): Promise<void> {
  const state = await sessionState(transaction, sessionId);

  if (state.mutationId !== null) {
    failManagedRequest(HttpStatusCode.Conflict, 'A session update is in progress');
  }
}

export function inputKey(id: string, sequence: number): string {
  return JSON.stringify([id, sequence]);
}

export async function queueInput(transaction: Tx, id: string, eventId: string): Promise<void> {
  const state = await sessionState(transaction, id);
  const next = await transaction.doc(ThreadInputs, inputKey(id, state.pendingTail), null);
  next.eventId = eventId;
  state.pendingTail += 1;

  // A message can wait behind a tool. Only the matching result or interrupt can resume that turn.
  if (state.waiting === null && !state.isBudgetReached) {
    await enqueue(transaction, id);
  }
}

export async function release(transaction: Tx, id: string): Promise<void> {
  const slot = await transaction.doc(Slot);

  if (slot.owner === id) {
    slot.owner = null;
  }
}
