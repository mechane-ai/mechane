import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { EntryRecord } from '@earendil-works/pi-durable';
import { RequestInvalid } from '@mechane/protocol';
import { boundTraceText, toolExecutionId as executionId } from '@mechane/records';
import { Schema } from 'effect';
import type { ActorHistoryEntry, ActorPageInput } from '../actor/client.ts';
import { ImportedHistory, TaskTurns } from '../actor/collections.ts';
import { NativeFields, StoredFields } from '../actor/records.ts';
import type { ActorAccess } from '../actor/types.ts';

const HISTORY_DEFAULT_ROWS = 50;
const HISTORY_MAX_ROWS = 100;
const HISTORY_TEXT_MAX_BYTES = 8192;

const HistoryCursor = Schema.Struct({
  workspaceId: Schema.String,
  mechId: Schema.String,
  imported: Schema.Int,
  native: Schema.NullOr(NativeFields),
});

const Message = Schema.Struct({ content: Schema.Union([Schema.String, Schema.Array(StoredFields)]) });

function contentParts(content: (typeof Message.Type)['content']): ReadonlyArray<string> {
  if (typeof content === 'string') {
    return [content];
  }

  const parts: Array<string> = [];

  for (const part of content) {
    if (part['type'] === 'text' && typeof part['text'] === 'string') {
      parts.push(part['text']);
    }

    if (part['type'] === 'toolCall' && typeof part['name'] === 'string') {
      parts.push(`Tool call: ${part['name']}`);
    }
  }

  return parts;
}

function messageText(messages: unknown): string {
  if (!Array.isArray(messages)) {
    return '';
  }

  const values: ReadonlyArray<unknown> = messages;
  const parts: Array<string> = [];

  for (const value of values) {
    if (Schema.is(Message)(value)) {
      parts.push(...contentParts(value.content));
    }
  }

  return parts.join('\n');
}

function archiveRecord(entry: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (Schema.is(StoredFields)(entry['record'])) {
    return entry['record'];
  }

  return entry;
}

function archiveTurnId(record: Readonly<Record<string, unknown>>): string | null {
  if (Schema.is(StoredFields)(record['run']) && typeof record['run']['id'] === 'string') {
    return record['run']['id'];
  }

  if (typeof record['runId'] === 'string') {
    return record['runId'];
  }

  return null;
}

function archiveCreatedAt(record: Readonly<Record<string, unknown>>): string | null {
  if (typeof record['createdAt'] === 'string') {
    return record['createdAt'];
  }

  return null;
}

function nativeCreatedAt(entry: EntryRecord): string | null {
  const timestamp = entry.model?.find((message) => {
    const value: unknown = message.timestamp;

    return value !== undefined;
  })?.timestamp;

  if (timestamp === undefined) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function archiveText(entry: Readonly<Record<string, unknown>>): string {
  const record = archiveRecord(entry);

  if (typeof record['text'] === 'string') {
    return record['text'];
  }

  if (Schema.is(StoredFields)(record['run'])) {
    return [record['run']['inputText'], record['run']['reply']].filter((part) => typeof part === 'string').join('\n');
  }

  if (typeof record['context'] === 'string') {
    return record['context'];
  }

  if (Array.isArray(record['modelMessages'])) {
    return messageText(record['modelMessages']);
  }

  if (Array.isArray(record['model'])) {
    return messageText(record['model']);
  }

  if (typeof record['type'] === 'string') {
    return record['type'];
  }

  const kind: unknown = entry['kind'] ?? 'history';

  return `Preserved ${String(kind)} record`;
}

function encodeCursor(value: typeof HistoryCursor.Type): string {
  return btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/[=]+$/u, '');
}

function nextHistoryCursor(value: typeof HistoryCursor.Type, hasMore: boolean): string | null {
  if (!hasMore) {
    return null;
  }

  return encodeCursor(value);
}

async function nativeTurnId(access: ActorAccess, entry: EntryRecord): Promise<string | null> {
  if (entry.byTaskId === undefined) {
    return null;
  }

  return (await TaskTurns.get(access.harness, String(entry.byTaskId), BACKGROUND_CONTEXT)) ?? null;
}

export async function historyPage(access: ActorAccess, input: ActorPageInput) {
  let cursor: typeof HistoryCursor.Type = { ...access.scope, imported: 0, native: null };

  if (input.after !== undefined && input.after !== null) {
    cursor = Schema.decodeUnknownSync(HistoryCursor)(
      JSON.parse(atob(input.after.replaceAll('-', '+').replaceAll('_', '/'))),
    );
  }

  if (cursor.workspaceId !== access.scope.workspaceId || cursor.mechId !== access.scope.mechId || cursor.imported < 0) {
    throw new RequestInvalid({ reason: 'The history cursor belongs to another mech' });
  }

  const limit = Math.max(1, Math.min(input.maxRows ?? HISTORY_DEFAULT_ROWS, HISTORY_MAX_ROWS));
  const importedCount = await ImportedHistory.count(access.harness, BACKGROUND_CONTEXT);

  if (cursor.imported > importedCount) {
    throw new RequestInvalid({ reason: 'The history cursor is beyond retained history' });
  }

  const entries: Array<ActorHistoryEntry> = [];

  const archive = await ImportedHistory.page(
    access.harness,
    { offset: cursor.imported, maxRows: limit },
    BACKGROUND_CONTEXT,
  );

  for (const [position, entry] of archive.items.entries()) {
    const index = cursor.imported + position;

    const record = archiveRecord(entry);
    const kind: unknown = entry['kind'] ?? 'record';

    entries.push({
      id: await executionId({ runId: access.scope.mechId, toolCallId: `imported-history:${index}` }),
      kind: `imported.${String(kind)}`,
      text: boundTraceText({
        text: archiveText(entry),
        omittedBytes: 0,
        maxBytes: HISTORY_TEXT_MAX_BYTES,
        keep: 'start',
      }).text,
      turnId: archiveTurnId(record),
      createdAt: archiveCreatedAt(record),
    });
  }

  const imported = cursor.imported + entries.length;

  if (entries.length === limit) {
    let hasMore = imported < importedCount;

    if (!hasMore) {
      const probe = await access.conversation.entries(
        { order: 'ascending' },
        1,
        cursor.native ?? undefined,
        BACKGROUND_CONTEXT,
      );

      hasMore = probe.items.length > 0;
    }

    const nextCursor = nextHistoryCursor({ ...access.scope, imported, native: cursor.native }, hasMore);

    return { entries, hasMore, nextCursor };
  }

  const native = await access.conversation.entries(
    { order: 'ascending' },
    limit - entries.length,
    cursor.native ?? undefined,
    BACKGROUND_CONTEXT,
  );

  for (const entry of native.items) {
    const turnId = await nativeTurnId(access, entry);

    entries.push({
      id: await executionId({ runId: access.scope.mechId, toolCallId: `history:${String(entry.id)}` }),
      kind: entry.kind,
      text: boundTraceText({
        text: messageText(entry.model),
        omittedBytes: 0,
        maxBytes: HISTORY_TEXT_MAX_BYTES,
        keep: 'start',
      }).text,
      turnId,
      createdAt: nativeCreatedAt(entry),
    });
  }

  const hasMore = native.next !== undefined;
  const nextCursor = nextHistoryCursor({ ...access.scope, imported, native: native.next ?? null }, hasMore);

  return { entries, hasMore, nextCursor };
}
