import { RequestInvalid } from '@mechane/protocol';
import type { SourceCompletion } from '@mechane/protocol';
import type { ActorPageInput } from '../client.ts';
import { stableJson } from '../state.ts';

const COMPLETION_PAGE_MAX_ROWS = 100;
const COMPLETION_PREFIX = 'archive.sandbox-completion:';

export function requireSameReceipt(previous: SourceCompletion, incoming: SourceCompletion): void {
  if (stableJson(previous) !== stableJson(incoming)) {
    throw new RequestInvalid({ reason: 'The completion differs from its archived terminal receipt' });
  }
}

export async function readArchivedCompletion(
  storage: Pick<DurableObjectStorage, 'get'>,
  executionId: string,
): Promise<SourceCompletion | undefined> {
  return await storage.get<SourceCompletion>(COMPLETION_PREFIX + executionId);
}

export async function listArchivedCompletions(storage: Pick<DurableObjectStorage, 'list'>, input: ActorPageInput) {
  const maxRows = Math.min(COMPLETION_PAGE_MAX_ROWS, Math.max(1, input.maxRows ?? COMPLETION_PAGE_MAX_ROWS));
  const range: Pick<DurableObjectListOptions, 'startAfter'> = {};

  if (input.after !== undefined && input.after !== null) {
    range.startAfter = COMPLETION_PREFIX + input.after;
  }

  const values = await storage.list<SourceCompletion>({ prefix: COMPLETION_PREFIX, ...range, limit: maxRows + 1 });
  const items = [...values.values()].slice(0, maxRows);
  const hasMore = values.size > maxRows;

  if (hasMore) {
    const nextCursor = items.at(-1)?.executionId ?? null;

    return { items, hasMore, nextCursor };
  }

  return { items, hasMore, nextCursor: null };
}

export async function retainArchivedCompletion(
  storage: Pick<DurableObjectStorage, 'transaction'>,
  incoming: SourceCompletion,
): Promise<void> {
  await storage.transaction(async (transaction) => {
    const previous = await readArchivedCompletion(transaction, incoming.executionId);

    if (previous === undefined) {
      await transaction.put(COMPLETION_PREFIX + incoming.executionId, incoming);
    } else {
      requireSameReceipt(previous, incoming);
    }
  });
}
