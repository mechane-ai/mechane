import { CompactionEntry, defineDocFamily } from '@earendil-works/pi-durable';
import type { ConversationId, EntryId, Tx } from '@earendil-works/pi-durable';
import { appendManagedEvent } from './event-log/write.ts';

const COMPACTION_MAX_ENTRIES = 64;

const Projected = defineDocFamily<{ readonly entry: EntryId | null }, null>({
  kind: 'managed.compaction-projection',
  version: 1,
  scope: 'session',
  family: true,
  initial: () => ({ entry: null }),
  checkpointWhen: () => true,
});

export async function projectManagedCompactions(
  transaction: Tx,
  sessionId: string,
  conversationId: ConversationId,
): Promise<boolean> {
  const cursor = await transaction.doc(Projected, sessionId, null);
  const newest = await transaction.latestEntryId(conversationId);

  if (newest === undefined || newest === cursor.entry) {
    return true;
  }

  const bounds: { minEntryId?: EntryId } = {};

  if (cursor.entry !== null) {
    bounds.minEntryId = cursor.entry;
  }

  const page = await transaction.scanEntries({ conversationId, order: 'ascending', ...bounds }, COMPACTION_MAX_ENTRIES);

  for (const entry of page.items) {
    if (entry.id !== cursor.entry && entry.kind === CompactionEntry.kind) {
      await appendManagedEvent(
        transaction,
        { sessionId, stableKey: `compaction:${entry.id}` },
        { type: 'agent.thread_context_compacted' },
      );
    }

    cursor.entry = entry.id;
  }

  return newest === cursor.entry;
}
