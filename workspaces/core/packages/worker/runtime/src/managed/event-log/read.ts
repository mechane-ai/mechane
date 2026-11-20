import { BYTES_PER_MEBIBYTE, HttpStatusCode } from '@mechane/records';
import type { ActorRecordReader } from '../../actor/record-store.ts';
import { failManagedRequest } from '../failure.ts';
import type { ManagedEvent, ManagedEventPage, ManagedEventPageInput } from '../protocol.ts';
import { indexedEvents, visibleEvent } from './collections.ts';
import { sessionEvents } from './payload-storage.ts';
import type { PreparedEvent } from './payload-storage.ts';
import { workerEvents } from './worker-feed.ts';

type ThreadScope = {
  readonly sessionId: string;
  readonly threadId?: string | null | undefined;
  readonly workerLeaseId?: string | undefined;
};

type ChangeQuery = ThreadScope & { readonly offset: number; readonly limit?: number | undefined };
type Phase = 'processed' | 'pending';

const INDEX_BATCH_ROWS = 64;
const PAGE_MAX_ROWS = 1000;
const PAGE_PAYLOAD_BYTES = 4 * BYTES_PER_MEBIBYTE;

const DEFAULT_PAGE_ROWS = 20;

function phasesInView(scope: ThreadScope): ReadonlyArray<Phase> {
  if (scope.workerLeaseId !== undefined) {
    return ['processed'];
  }

  return ['processed', 'pending'];
}

function viewIndex(scope: ThreadScope, phase: Phase) {
  if (scope.workerLeaseId !== undefined) {
    return workerEvents(scope.sessionId);
  }

  return indexedEvents(scope.sessionId, scope.threadId ?? null, phase);
}

function validateLimit(maxRows: number): void {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > PAGE_MAX_ROWS) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Event page limit must be an integer between 1 and 1000');
  }
}

function timestamp(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Invalid event timestamp');
  }

  return parsed;
}

function filter(input: ManagedEventPageInput) {
  const gte = timestamp(input.createdAfter);
  const gt = timestamp(input.createdAfterExclusive);
  const lte = timestamp(input.createdBefore);
  const lt = timestamp(input.createdBeforeExclusive);
  const types = new Set(input.types);
  const hasTimeFilter = [gte, gt, lte, lt].some((bound) => bound !== undefined);
  const earliest = Math.max(gte ?? -Infinity, (gt ?? -Infinity) + 1);
  const latest = Math.min(lte ?? Infinity, (lt ?? Infinity) - 1);

  return (event: ManagedEvent): boolean => {
    if (types.size > 0 && !types.has(event.type)) {
      return false;
    }

    if (event.processed_at === null) {
      return !hasTimeFilter;
    }

    const time = Date.parse(event.processed_at);

    return time >= earliest && time <= latest;
  };
}

async function cursorPhase(
  reader: ActorRecordReader,
  scope: ThreadScope,
  id: string | undefined,
): Promise<Phase | undefined> {
  if (id === undefined) {
    return undefined;
  }

  for (const phase of phasesInView(scope)) {
    const index = viewIndex(scope, phase);

    if ((await index.get(reader, id)) !== undefined) {
      return phase;
    }
  }

  failManagedRequest(HttpStatusCode.BadRequest, 'Event cursor does not belong to this session thread');
}

function eventPage(events: ReadonlyArray<ManagedEvent>, hasMore: boolean): ManagedEventPage {
  return { data: events, has_more: hasMore, first_id: events.at(0)?.id ?? null, last_id: events.at(-1)?.id ?? null };
}

async function* historicalIds(reader: ActorRecordReader, input: ManagedEventPageInput) {
  const start = await cursorPhase(reader, input, input.afterId);

  await cursorPhase(reader, input, input.beforeId);

  const isReversed = input.order === 'desc';
  let phases = phasesInView(input);

  if (isReversed) {
    phases = phases.toReversed();
  }

  if (start !== undefined) {
    phases = phases.slice(phases.indexOf(start));
  }

  for (const phase of phases) {
    let after = input.afterId;

    if (phase !== start) {
      after = undefined;
    }

    yield* viewIndex(input, phase).scan(reader, { after, maxRows: INDEX_BATCH_ROWS, isReversed });
  }
}

type PageSelection = ThreadScope & {
  readonly maxRows: number;
  readonly matches?: (event: ManagedEvent) => boolean;
  readonly beforeId?: string | undefined;
  readonly alreadyMirrored?: ((id: string) => Promise<boolean>) | undefined;
};

async function pageItem(selection: PageSelection, entry: PreparedEvent) {
  const { id, type, processed_at } = entry.event;

  if ((await selection.alreadyMirrored?.(id)) === true) {
    const header = { id, type, processed_at };

    return { wireBytes: new TextEncoder().encode(JSON.stringify(header)).byteLength, load: () => header };
  }

  return {
    wireBytes: entry.wireBytes,
    async load() {
      return visibleEvent(await entry.load(), selection.threadId ?? null);
    },
  };
}

async function collectPage(
  reader: ActorRecordReader,
  selection: PageSelection,
  ids: AsyncIterable<string> | Iterable<string>,
) {
  const events = sessionEvents(selection.sessionId);
  const rows: Array<ManagedEvent> = [];
  let bytes = 0;

  for await (const id of ids) {
    if (id === selection.beforeId) {
      break;
    }

    const entry = await events.inspect(reader, id);

    if (entry === undefined) {
      throw new Error('Managed event index points to a missing record');
    }

    if (selection.matches?.(entry.event) !== false) {
      const responseEvent = await pageItem(selection, entry);

      if (
        rows.length === selection.maxRows ||
        (rows.length > 0 && bytes + responseEvent.wireBytes > PAGE_PAYLOAD_BYTES)
      ) {
        return eventPage(rows, true);
      }

      rows.push(await responseEvent.load());

      bytes += responseEvent.wireBytes;
    }
  }

  return eventPage(rows, false);
}

export async function listManagedEvents(
  reader: ActorRecordReader,
  input: ManagedEventPageInput,
): Promise<ManagedEventPage> {
  const maxRows = input.limit ?? DEFAULT_PAGE_ROWS;

  validateLimit(maxRows);

  return await collectPage(reader, { ...input, maxRows, matches: filter(input) }, historicalIds(reader, input));
}

export async function managedEventTail(reader: ActorRecordReader, input: ThreadScope): Promise<number> {
  const index = viewIndex(input, 'processed');

  return await index.count(reader);
}

export async function readManagedEventTail(
  reader: ActorRecordReader,
  input: ChangeQuery,
  alreadyMirrored?: PageSelection['alreadyMirrored'],
) {
  const limit = input.limit ?? INDEX_BATCH_ROWS;

  validateLimit(limit);

  if (!Number.isSafeInteger(input.offset) || input.offset < 0) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Invalid managed event stream offset');
  }

  const index = viewIndex(input, 'processed');
  const page = await index.page(reader, { offset: input.offset, maxRows: limit });
  const { data: events } = await collectPage(reader, { ...input, maxRows: limit, alreadyMirrored }, page.items);

  return { data: events, offset: input.offset + events.length };
}
