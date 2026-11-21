import type { Tx } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { appendManagedEvent } from './event-log/write.ts';
import type { ManagedSessionOpen, ManagedSessionThread, ManagedWireObject } from './protocol.ts';
import { sessionState } from './scheduler.ts';
import { liveThreadIds, publicThread, requiredThread, threadRecords } from './thread-records.ts';
import type { ThreadRecord } from './thread-records.ts';
import { transitionManagedThread } from './thread-state.ts';

const CHILD_THREAD_MAX_COUNT = 25;

type Registration = {
  readonly sessionId: string;
  readonly threadId: string;
  readonly parentThreadId: string | null;
  readonly agent: ManagedWireObject;
  readonly createdAt?: string | undefined;
};

function threadAgent(agent: ManagedWireObject): ManagedWireObject {
  if (typeof agent['id'] !== 'string' || typeof agent['name'] !== 'string' || !Number.isSafeInteger(agent['version'])) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Session thread requires a pinned agent definition');
  }

  return {
    type: 'agent',
    id: agent['id'],
    version: agent['version'],
    name: agent['name'],
    description: agent['description'],
    execution_identity: agent['execution_identity'],
    mcp_servers: agent['mcp_servers'],
    model: agent['model'],
    skills: agent['skills'],
    system: agent['system'],
    tools: agent['tools'],
  };
}

async function register(transaction: Tx, input: Registration) {
  const records = threadRecords(input.sessionId);
  const agent = threadAgent(input.agent);
  const previous = await records.read(transaction, input.threadId);

  if (previous !== undefined) {
    if (
      previous.parentId !== input.parentThreadId ||
      previous.agent['id'] !== agent['id'] ||
      previous.agent['version'] !== agent['version']
    ) {
      failManagedRequest(HttpStatusCode.Conflict, 'Thread identity already belongs to a different agent');
    }

    return { record: previous, created: false };
  }

  const live = liveThreadIds(input.sessionId);

  if (input.parentThreadId !== null) {
    const parent = await requiredThread(transaction, input.sessionId, input.parentThreadId);

    if (parent.status === 'terminated') {
      failManagedRequest(HttpStatusCode.BadRequest, 'Cannot spawn a thread from a terminated parent');
    }

    const count = await live.countInTransaction(transaction);

    if (count > CHILD_THREAD_MAX_COUNT) {
      failManagedRequest(HttpStatusCode.BadRequest, 'The session already has 25 live child threads');
    }
  }

  const now = Date.parse(input.createdAt ?? new Date().toISOString());

  if (!Number.isFinite(now)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Invalid thread creation timestamp');
  }

  const record: ThreadRecord = {
    id: input.threadId,
    sessionId: input.sessionId,
    parentId: input.parentThreadId,
    agent,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    archivedAt: null,
    status: 'idle',
    reason: null,
    activeMs: 0,
    hasTransitioned: false,
    usage: null,
  };

  await records.put(transaction, record.id, record);
  await live.put(transaction, record.id, record.id);

  return { record, created: true };
}

export async function registerManagedPrimary(transaction: Tx, input: ManagedSessionOpen): Promise<void> {
  const registration: Registration = {
    sessionId: input.sessionId,
    threadId: input.threadId,
    parentThreadId: null,
    agent: input.agent,
    createdAt: input.createdAt,
  };

  await register(transaction, registration);
}

type Child = Omit<Registration, 'parentThreadId'> & { readonly parentThreadId: string };

export async function registerManagedChild(transaction: Tx, input: Child): Promise<ManagedSessionThread> {
  const session = await sessionState(transaction, input.sessionId);

  if (session.isArchived || session.status === 'terminated') {
    failManagedRequest(HttpStatusCode.BadRequest, 'Cannot spawn a thread in a terminated session');
  }

  const result = await register(transaction, input);

  if (!result.created) {
    return publicThread(result.record);
  }

  await appendManagedEvent(
    transaction,
    { sessionId: input.sessionId, threadId: input.threadId },
    {
      type: 'session.thread_created',
      session_thread_id: input.threadId,
      agent_name: input.agent['name'],
      workflow_run_id: null,
    },
  );

  return await transitionManagedThread(transaction, {
    sessionId: input.sessionId,
    threadId: input.threadId,
    status: 'running',
  });
}
