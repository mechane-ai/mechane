import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { retireDelegatedThread } from './delegation/retire.ts';
import { failManagedRequest } from './failure.ts';
import type {
  ManagedSessionThread,
  ManagedSessionThreadReference,
  ManagedThreadPage,
  ManagedThreadPageInput,
  ManagedWireObject,
} from './protocol.ts';
import { ensureManagedSessionAvailable, sessionState } from './scheduler.ts';
import { liveThreadIds, publicThread, requiredThread, threadNotFound, threadRecords } from './thread-records.ts';
import type { ThreadRecord } from './thread-records.ts';
import { retireManagedFocus } from './thread-retirement.ts';
import { transitionManagedThread } from './thread-state.ts';

export async function managedThread(
  harness: ActorRecordReader,
  reference: ManagedSessionThreadReference,
): Promise<ManagedSessionThread> {
  const value = await threadRecords(reference.sessionId).get(harness, reference.threadId, BACKGROUND_CONTEXT);

  if (value === undefined) {
    return threadNotFound();
  }

  return publicThread(value);
}

const THREAD_PAGE_MAX_COUNT = 1000;
const THREAD_SCAN_PAGE_COUNT = 100;

export async function managedThreads(
  harness: ActorRecordReader,
  input: ManagedThreadPageInput,
): Promise<ManagedThreadPage> {
  const limit = input.limit ?? THREAD_PAGE_MAX_COUNT;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > THREAD_PAGE_MAX_COUNT) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Thread list limit must be between 1 and 1000');
  }

  const collection = threadRecords(input.sessionId);
  const matching = new Set(input.statuses);

  function select(items: ReadonlyArray<ThreadRecord>) {
    return items.filter((record) => matching.size === 0 || matching.has(record.status)).map(publicThread);
  }

  let page = await collection.page(harness, { after: input.afterId, maxRows: THREAD_SCAN_PAGE_COUNT });
  const threads = select(page.items);

  while (threads.length <= limit && page.hasMore) {
    page = await collection.page(harness, { offset: page.nextOffset, maxRows: THREAD_SCAN_PAGE_COUNT });

    threads.push(...select(page.items));
  }

  const visible = threads.slice(0, limit);

  return {
    data: visible,
    has_more: threads.length > limit,
    first_id: visible[0]?.id ?? null,
    last_id: visible.at(-1)?.id ?? null,
  };
}

export async function archiveManagedThread(transaction: Tx, input: ManagedSessionThreadReference) {
  await ensureManagedSessionAvailable(transaction, input.sessionId);

  const current = await requiredThread(transaction, input.sessionId, input.threadId);

  if (current.archivedAt === null && current.status !== 'idle') {
    failManagedRequest(HttpStatusCode.BadRequest, 'Only an idle thread can be archived');
  }

  if (current.parentId !== null) {
    await retireDelegatedThread(transaction, input.sessionId, input.threadId);
  }

  if (current.archivedAt !== null) {
    return publicThread(current);
  }

  if (current.parentId === null) {
    await retireManagedFocus(transaction, input.sessionId);
  }

  return await transitionManagedThread(transaction, { ...input, status: 'terminated', isArchived: true });
}

export async function archiveManagedSessionThreads(transaction: Tx, sessionId: string): Promise<void> {
  const session = await sessionState(transaction, sessionId);

  await retireManagedFocus(transaction, sessionId);

  const ids = await liveThreadIds(sessionId).allInTransaction(transaction);

  for (const threadId of ids) {
    if (threadId !== session.threadId) {
      await retireDelegatedThread(transaction, sessionId, threadId);
    }

    await transitionManagedThread(transaction, { sessionId, threadId, status: 'terminated', isArchived: true });
  }
}

type AgentUpdate = ManagedSessionThreadReference & {
  readonly tools?: ReadonlyArray<ManagedWireObject>;
  readonly mcpServers?: ReadonlyArray<ManagedWireObject>;
};

export async function updateManagedThreadAgent(transaction: Tx, changes: AgentUpdate): Promise<void> {
  const { sessionId, threadId } = changes;
  const record = await requiredThread(transaction, sessionId, threadId);
  const agent = { ...record.agent };

  if (changes.tools !== undefined) {
    agent['tools'] = changes.tools;
  }

  if (changes.mcpServers !== undefined) {
    agent['mcp_servers'] = changes.mcpServers;
  }

  await threadRecords(sessionId).put(transaction, threadId, {
    ...record,
    updatedAt: Math.max(record.updatedAt, Date.now()),
    agent,
  });
}
