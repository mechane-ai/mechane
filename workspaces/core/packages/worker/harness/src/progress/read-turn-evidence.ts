import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Message, ToolCall, ToolResultMessage } from '@earendil-works/pi-ai';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Cursor, EntryQuery, EntryRecord, Tx } from '@earendil-works/pi-durable';
import { BoundedCallStatus } from '@mechane/protocol';
import type { BoundedToolCall } from '@mechane/protocol';
import { ModelToolCallId } from '@mechane/records';
import { DateTime, Option, Result, Schema } from 'effect';
import { INBOX_ITEM_ENTRY_KIND } from '../constants.ts';
import type { HarnessHandle, InboxItemQuery, TurnEvidence } from '../types.ts';

type ReadTurnEvidenceInput = HarnessHandle & InboxItemQuery;

type EntryScan = {
  readonly entries: ReadonlyArray<EntryRecord>;
  /** Absent at the request's last transcript page. */
  readonly next: Option.Option<Cursor>;
};

type EntryScanInput = { readonly transaction: Tx; readonly query: EntryQuery; readonly scan: EntryScan };
type ToolEvidenceInput = { readonly call: ToolCall; readonly messages: ReadonlyArray<Message> };
type ResultTimeInput = { readonly result: ToolResultMessage };

type ResultStatusInput = {
  /** Absent when the tool has no committed result. */
  readonly result: Option.Option<ToolResultMessage>;
};

const ENTRY_PAGE_ITEMS = 100;
const PiMessageRole = { Assistant: 'assistant', ToolResult: 'toolResult' } as const;
const PiContentType = { ToolCall: 'toolCall' } as const;
const ToolResultJson = Schema.fromJsonString(Schema.Json);

/** Pi owns these records. Reading through its transaction also recovers tools committed before an object restart. */
export async function readTurnEvidence({ harness, inboxItemId }: ReadTurnEvidenceInput): Promise<TurnEvidence> {
  return await harness.commit(async (transaction) => {
    const submitted = await transaction.submissionByRequest(ROOT_CONVERSATION_ID, inboxItemId);
    const submission = Option.fromNullishOr(submitted);
    const entryId = Option.flatMapNullishOr(submission, (record) => record.entry);

    if (Option.isNone(entryId)) {
      return { toolCalls: [], unknowns: [] };
    }

    const base = { conversationId: ROOT_CONVERSATION_ID, minEntryId: entryId.value, order: 'ascending' } as const;
    const answerId = Option.flatMapNullishOr(submission, (record) => record.answer);
    const query = Option.match(answerId, { onNone: () => base, onSome: (maxEntryId) => ({ ...base, maxEntryId }) });

    const empty: EntryScan = { entries: [], next: Option.none() };
    let scan = await scanEvidenceEntries({ transaction, query, scan: empty });

    while (Option.isSome(scan.next)) {
      scan = await scanEvidenceEntries({ transaction, query, scan });
    }

    const messages = scan.entries.flatMap((entry) => {
      const model = Option.fromNullishOr(entry.model);

      return Option.getOrElse(model, () => []);
    });

    const calls = messages
      .filter((message) => message.role === PiMessageRole.Assistant)
      .flatMap((message) => message.content.filter((part) => part.type === PiContentType.ToolCall));

    const toolCalls = calls.map((call) => toolEvidence({ call, messages }));
    const hasUnknown = toolCalls.some((call) => call.status === BoundedCallStatus.Unknown);

    if (hasUnknown) {
      return { toolCalls, unknowns: ['Some tool calls have no committed result; execution outcome is unknown.'] };
    }

    return { toolCalls, unknowns: [] };
  }, BACKGROUND_CONTEXT);
}

async function scanEvidenceEntries({ transaction, query, scan }: EntryScanInput): Promise<EntryScan> {
  const cursor = Option.getOrUndefined(scan.next);
  const page = await transaction.scanEntries(query, ENTRY_PAGE_ITEMS, cursor);

  const boundary = page.items.findIndex(
    (entry) => entry.kind === INBOX_ITEM_ENTRY_KIND && entry.id !== query.minEntryId,
  );

  if (boundary !== -1) {
    return { entries: [...scan.entries, ...page.items.slice(0, boundary)], next: Option.none() };
  }

  return { entries: [...scan.entries, ...page.items], next: Option.fromNullishOr(page.next) };
}

function toolEvidence({ call, messages }: ToolEvidenceInput): BoundedToolCall {
  const matched = messages.find(
    (message) => message.role === PiMessageRole.ToolResult && message.toolCallId === call.id,
  );

  const found = Option.fromNullishOr(matched);
  const toolResult = Option.filter(found, (message) => message.role === PiMessageRole.ToolResult);

  return {
    id: ModelToolCallId.make(call.id),
    name: call.name,
    input: call.arguments,
    output: Option.map(toolResult, (result) => toolOutput({ result })),
    status: resultStatus({ result: toolResult }),
    startedAt: Option.flatMap(toolResult, (result) => resultStart({ result })),
    endedAt: Option.map(toolResult, (message) => DateTime.makeUnsafe(message.timestamp)),
  };
}

function toolOutput({ result }: ResultTimeInput): typeof Schema.Json.Type {
  const json = JSON.stringify(result);
  const decoded = Schema.decodeUnknownResult(ToolResultJson)(json);

  return Result.getOrThrow(decoded);
}

function resultStart({ result }: ResultTimeInput): Option.Option<DateTime.Utc> {
  const duration = Option.fromNullishOr(result.durationMs);

  return Option.map(duration, (durationMs) => DateTime.makeUnsafe(result.timestamp - durationMs));
}

function resultStatus({ result }: ResultStatusInput): BoundedToolCall['status'] {
  if (Option.isNone(result)) {
    return BoundedCallStatus.Unknown;
  }

  if (result.value.isError) {
    return BoundedCallStatus.Failed;
  }

  return BoundedCallStatus.Completed;
}
