import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ControlStore, ImportedSpendReservation as SpendReservation } from '@mechane/control-store';
import { RequestInvalid, TOOL_TRACE_OUTPUT_MAX_BYTES, TurnNotFound } from '@mechane/protocol';
import {
  boundTraceText,
  Bytes,
  toolExecutionId as executionId,
  RecordText,
  toolInvocationId,
  TurnId,
} from '@mechane/records';
import { Schema } from 'effect';
import type { ActorPageInput, ActorTrace, MechScope } from '../actor/client.ts';
import {
  Cancellations,
  Effects,
  Events,
  ImportedEventPointers,
  ImportedHistory,
  ImportedMessagePointers,
  ImportedRunPointers,
  Messages,
  runAttempts,
  runEvents,
  Turns,
} from '../actor/collections.ts';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { decodeStored, RunRecord, StoredFields } from '../actor/records.ts';
import type { ActivityEvent, ConsoleMessage, Run } from '../domain.ts';
import { providerFailureReason } from '../models/provider-diagnostic.ts';
import { nativeEvent } from '../notifications/events.ts';
import {
  importedTraces,
  readImportedCancellation,
  readImportedEventAt,
  readImportedMessageAt,
  readImportedTrace,
} from './imported.ts';

const ACTOR_PAGE_DEFAULT_ROWS = 50;
const ACTOR_PAGE_MAX_ROWS = 100;
const EVENT_PAGE_MAX_ROWS = 100;
const MESSAGE_PAGE_MAX_ROWS = 100;
const BINARY_SEARCH_PARTITIONS = 2;
const TOOL_END_EVENTS: ReadonlySet<string> = new Set(['tool.completed', 'tool.failed']);
const REFUSED_ATTEMPT_STATES: ReadonlySet<string> = new Set(['refused', 'released']);
const NATIVE_TURN_LIMIT_ERROR = 'Native conversation ended unanswered: turn_limit';

type TurnInput = { readonly turnId: string };
export type HistoricalView = { readonly harness: ActorRecordReader; readonly scope: MechScope };

type TraceView = HistoricalView & {
  readonly withControl: <T>(operation: (store: Pick<ControlStore, 'getProviderAttempts'>) => Promise<T>) => Promise<T>;
};

type RunPageCursor = { readonly nativeAfter: string | undefined; readonly importedAfter: string | undefined };
type RecordedProviderAttempt = NonNullable<Awaited<ReturnType<ControlStore['getProviderAttempt']>>>;

type EventPageInput = {
  readonly afterSequence?: number | undefined;
  readonly beforeSequence?: number | undefined;
  readonly isNewestFirst?: boolean | undefined;
  readonly runId?: string | undefined;
  readonly maxRows?: number | undefined;
};

type MessagePageInput = {
  readonly beforeSequence?: number | undefined;
  readonly afterSequence?: number | undefined;
  readonly maxRows?: number | undefined;
};

type SequenceSource<T> = { readonly count: number; readonly at: (ordinal: number) => Promise<T | undefined> };

type SequenceOffsetInput<T> = {
  readonly source: SequenceSource<T>;
  readonly sequence: number;
  readonly isExclusive: boolean;
};

type SequenceRowsInput<T> = {
  readonly source: SequenceSource<T>;
  readonly afterSequence: number;
  readonly beforeSequence: number;
  readonly maxRows: number;
  readonly isReversed: boolean;
};

const UpstreamUsage = Schema.Struct({
  prompt_tokens: Schema.Number,
  completion_tokens: Schema.Number,
  prompt_tokens_details: Schema.optionalKey(
    Schema.Struct({
      cached_tokens: Schema.optionalKey(Schema.Number),
      cache_write_tokens: Schema.optionalKey(Schema.Number),
    }),
  ),
});

const TraceText = Schema.Struct({ text: RecordText, omittedBytes: Bytes });

function traceTextRecord(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = Schema.decodeUnknownSync(TraceText)(value);

  return { text: text.text, omitted_bytes: text.omittedBytes };
}

function failureNotice(error: string | null): string | undefined {
  if (error === NATIVE_TURN_LIMIT_ERROR) {
    return error;
  }

  return providerFailureReason(error);
}

function meteredUsage(value: Readonly<Record<string, unknown>> | null): SpendReservation['usage'] {
  if (value === null) {
    return null;
  }

  const usage = Schema.decodeUnknownSync(UpstreamUsage)(value);

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens ?? 0,
  };
}

function accountingDispatch(attempt: RecordedProviderAttempt): SpendReservation {
  const hasSettlement = attempt.actualMicros !== null && attempt.settledAt !== null && attempt.upstreamUsage !== null;

  if (attempt.state === 'settled' && !hasSettlement) {
    throw new RequestInvalid({ reason: 'The settled provider attempt has incomplete accounting' });
  }

  const dispatch = {
    id: attempt.id,
    runId: attempt.activationId,
    workspaceId: attempt.workspaceId,
    mechId: attempt.mechId,
    model: attempt.model,
    reservedMicros: attempt.reservedMicros,
    settledMicros: attempt.actualMicros,
    usage: meteredUsage(attempt.upstreamUsage),
    createdAt: attempt.createdAt,
    settledAt: attempt.settledAt,
  };

  if (attempt.state === 'settled') {
    return { ...dispatch, state: 'settled' };
  }

  if (REFUSED_ATTEMPT_STATES.has(attempt.state)) {
    return { ...dispatch, state: 'refused' };
  }

  return { ...dispatch, state: 'reserved' };
}

async function readDispatches(access: TraceView, run: Run, ids: ReadonlyArray<string>) {
  if (ids.length === 0) {
    return [];
  }

  return await access.withControl(async (store) => {
    const dispatches: Array<SpendReservation> = [];
    const attempts = await store.getProviderAttempts({ ...access.scope, ids });

    for (const [index, id] of ids.entries()) {
      const attempt = attempts[index];

      if (attempt !== null && attempt !== undefined) {
        const hasScope = attempt.workspaceId === access.scope.workspaceId && attempt.mechId === access.scope.mechId;
        const hasIdentity = attempt.id === id && attempt.activationId === run.id;

        if (!hasScope || !hasIdentity) {
          throw new RequestInvalid({ reason: 'The provider accounting attempt belongs to another turn' });
        }

        dispatches.push(accountingDispatch(attempt));
      }
    }

    return dispatches;
  });
}

function bashOutput(result: typeof StoredFields.Type): ReturnType<typeof boundTraceText> | null {
  if (typeof result['output'] !== 'string') {
    return null;
  }

  let omittedBytes = 0;

  if (typeof result['omittedBytes'] === 'number') {
    ({ omittedBytes } = result);
  }

  return boundTraceText({ text: result['output'], omittedBytes, maxBytes: TOOL_TRACE_OUTPUT_MAX_BYTES, keep: 'end' });
}

function bashResult(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = decodeStored(StoredFields, value);

  const receipt = {
    status: result['status'],
    exit_code: result['exitCode'] ?? null,
    duration_ms: result['durationMs'] ?? null,
    output: traceTextRecord(bashOutput(result)),
  };

  if (result['status'] === 'refused' && typeof result['message'] === 'string') {
    const refusal = boundTraceText({
      text: result['message'],
      omittedBytes: 0,
      maxBytes: TOOL_TRACE_OUTPUT_MAX_BYTES,
      keep: 'start',
    });

    return { ...receipt, refusal: traceTextRecord(refusal) };
  }

  return receipt;
}

async function runPageCursor(access: HistoricalView, after: string | undefined): Promise<RunPageCursor> {
  if (after === undefined) {
    return { nativeAfter: undefined, importedAfter: undefined };
  }

  const turn = await Turns.get(access.harness, after, BACKGROUND_CONTEXT);

  if (turn !== undefined) {
    return { nativeAfter: after, importedAfter: undefined };
  }

  if ((await ImportedRunPointers.get(access.harness, after, BACKGROUND_CONTEXT)) === undefined) {
    throw new RequestInvalid({ reason: 'The page cursor does not belong to this mech' });
  }

  return { nativeAfter: undefined, importedAfter: after };
}

export async function listRuns(access: HistoricalView, input: ActorPageInput) {
  const limit = Math.max(1, Math.min(input.maxRows ?? ACTOR_PAGE_DEFAULT_ROWS, ACTOR_PAGE_MAX_ROWS));
  const cursor = await runPageCursor(access, input.after ?? undefined);
  const items: Array<Run> = [];
  let hasMore = false;

  if (cursor.importedAfter === undefined) {
    const native = await Turns.page(
      access.harness,
      { after: cursor.nativeAfter, maxRows: limit + 1, isReversed: true },
      BACKGROUND_CONTEXT,
    );

    items.push(...native.items.map((row) => decodeStored(RunRecord, row.value)));

    hasMore = native.hasMore;
  }

  if (items.length <= limit) {
    const imported = await ImportedRunPointers.page(
      access.harness,
      { after: cursor.importedAfter, maxRows: limit + 1 - items.length },
      BACKGROUND_CONTEXT,
    );

    for (const pointer of imported.items) {
      const raw = await ImportedHistory.get(access.harness, pointer, BACKGROUND_CONTEXT);
      const trace = importedTraces([raw], access.scope)[0];

      if (trace === undefined) {
        throw new RequestInvalid({ reason: 'The preserved turn pointer has no trace' });
      }

      items.push(trace.run);
    }

    hasMore = imported.hasMore;
  }

  return { items: items.slice(0, limit), hasMore: hasMore || items.length > limit };
}

export async function readRun(access: HistoricalView, input: TurnInput): Promise<Run | null> {
  const turn = await Turns.get(access.harness, input.turnId, BACKGROUND_CONTEXT);

  if (turn === undefined) {
    const imported = await readImportedTrace(access.harness, access.scope, input.turnId);

    return imported?.run ?? null;
  }

  return decodeStored(RunRecord, turn.value);
}

export async function readCancellation(access: HistoricalView, input: TurnInput) {
  const cancellation = await Cancellations.get(access.harness, input.turnId, BACKGROUND_CONTEXT);

  if (cancellation !== undefined) {
    return { cancelerId: cancellation.cancelerId, canceledAt: cancellation.requestedAt };
  }

  return await readImportedCancellation(access.harness, access.scope, input.turnId);
}

export async function readTrace(access: TraceView, input: TurnInput): Promise<ActorTrace> {
  const run = await readRun(access, input);

  if (run === null) {
    throw new TurnNotFound({ turnId: TurnId.make(input.turnId) });
  }

  if (run.runtimeSource === 'imported') {
    const trace = await readImportedTrace(access.harness, access.scope, run.id);

    if (trace === null) {
      throw new RequestInvalid({ reason: 'The preserved turn has no trace' });
    }

    return trace;
  }

  const eventIds = await runEvents(run.id).all(access.harness, BACKGROUND_CONTEXT);
  const events: Array<ActivityEvent> = [];

  for (const id of eventIds) {
    const event = await Events.get(access.harness, id, BACKGROUND_CONTEXT);

    if (event !== undefined) {
      events.push(await nativeEvent(access.harness, event));
    }
  }

  const attemptIds = await runAttempts(run.id).all(access.harness, BACKGROUND_CONTEXT);
  const dispatches = await readDispatches(access, run, attemptIds);

  const starts = events.filter((event) => event.type === 'tool.started');
  const calls: Array<Readonly<Record<string, unknown>>> = [];

  for (const start of starts) {
    const end = events.findLast(
      (event) => event.payload['nativeTaskId'] === start.payload['nativeTaskId'] && TOOL_END_EVENTS.has(event.type),
    );

    let status = 'running';

    if (end !== undefined) {
      status = 'completed';

      if (end.type === 'tool.failed') {
        status = 'failed';
      }
    }

    const call: Record<string, unknown> = {
      id: String(start.payload['toolCallId']),
      name: String(start.payload['toolName']),
      status,
      started_at: start.createdAt,
      ended_at: end?.createdAt ?? null,
    };

    const nativeTaskId = start.payload['nativeTaskId'];

    if (Schema.is(Schema.Int)(nativeTaskId)) {
      call['invocation_id'] = toolInvocationId({ mechId: run.mechId, nativeTaskId });
    }

    const invocationId = call['invocation_id'];

    if (start.payload['toolName'] === 'bash' && typeof invocationId === 'string') {
      const id = await executionId({ runId: run.id, toolCallId: invocationId });

      const effect = await Effects.get(access.harness, id, BACKGROUND_CONTEXT);

      const command = traceTextRecord(
        events.find((event) => event.type === 'tool.input' && event.payload['executionId'] === id)?.payload['command'],
      );

      calls.push({
        ...call,
        inspection: { kind: 'bash', execution_id: id, command, result: bashResult(effect?.result) },
      });
    } else {
      calls.push(call);
    }
  }

  const diagnostic = failureNotice(run.error);
  const evidenceNotices: Array<string> = [];

  if (diagnostic !== undefined) {
    evidenceNotices.push(diagnostic);
  }

  return { run, events, dispatches, toolCalls: calls, evidenceNotices };
}

async function sequenceOffset<T extends { readonly sequence: number }>({
  source,
  sequence,
  isExclusive,
}: SequenceOffsetInput<T>): Promise<number> {
  let lower = 0;
  let upper = source.count;

  while (lower < upper) {
    const middle = Math.floor((lower + upper) / BINARY_SEARCH_PARTITIONS);
    const row = await source.at(middle);

    if (row === undefined) {
      throw new Error('The ordered record index has a missing row');
    }

    if (row.sequence < sequence || (isExclusive && row.sequence === sequence)) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return lower;
}

async function sequenceRows<T extends { readonly sequence: number }>({
  source,
  afterSequence,
  beforeSequence,
  maxRows,
  isReversed,
}: SequenceRowsInput<T>): Promise<ReadonlyArray<T>> {
  const lower = await sequenceOffset({ source, sequence: afterSequence, isExclusive: true });
  const upper = await sequenceOffset({ source, sequence: beforeSequence, isExclusive: false });
  const items: Array<T> = [];
  let position = lower;
  let direction = 1;

  if (isReversed) {
    position = upper - 1;
    direction = -1;
  }

  while (position >= lower && position < upper && items.length < maxRows) {
    const row = await source.at(position);

    if (row === undefined) {
      throw new Error('The ordered record page has a missing row');
    }

    items.push(row);

    position += direction;
  }

  return items;
}

async function importedEventSource(
  access: HistoricalView,
  runId: string | undefined,
): Promise<SequenceSource<ActivityEvent>> {
  if (runId !== undefined) {
    const trace = await readImportedTrace(access.harness, access.scope, runId);
    const events = trace?.events ?? [];

    return { count: events.length, at: async (ordinal) => events[ordinal] };
  }

  return {
    count: await ImportedEventPointers.count(access.harness, BACKGROUND_CONTEXT),
    at: (ordinal) => readImportedEventAt(access.harness, access.scope, ordinal),
  };
}

async function nativeEventSource(
  access: HistoricalView,
  runId: string | undefined,
): Promise<SequenceSource<ActivityEvent>> {
  if (runId !== undefined) {
    const index = runEvents(runId);

    return {
      count: await index.count(access.harness, BACKGROUND_CONTEXT),
      at: async (ordinal) => {
        const id = await index.at(access.harness, ordinal, BACKGROUND_CONTEXT);

        if (id === undefined) {
          return;
        }

        return await Events.get(access.harness, id, BACKGROUND_CONTEXT);
      },
    };
  }

  return {
    count: await Events.count(access.harness, BACKGROUND_CONTEXT),
    at: (ordinal) => Events.at(access.harness, ordinal, BACKGROUND_CONTEXT),
  };
}

export async function listEvents(access: HistoricalView, input: EventPageInput) {
  const limit = Math.max(1, Math.min(input.maxRows ?? EVENT_PAGE_MAX_ROWS, EVENT_PAGE_MAX_ROWS));

  const bounds = {
    afterSequence: input.afterSequence ?? 0,
    beforeSequence: input.beforeSequence ?? Number.MAX_SAFE_INTEGER,
    maxRows: limit + 1,
    isReversed: input.isNewestFirst === true,
  };

  const importedSource = await importedEventSource(access, input.runId);
  const nativeSource = await nativeEventSource(access, input.runId);
  const imported = await sequenceRows({ source: importedSource, ...bounds });
  const current = await sequenceRows({ source: nativeSource, ...bounds });
  const ordered = [...imported, ...current].toSorted((left, right) => left.sequence - right.sequence);
  let selected = ordered.slice(0, limit);
  let afterSequence = selected.at(-1)?.sequence ?? input.afterSequence ?? 0;

  if (input.isNewestFirst === true) {
    selected = ordered.slice(-limit);
    afterSequence = selected[0]?.sequence ?? input.afterSequence ?? 0;
  }

  const nativeIds = new Set(current.map((event) => event.id));
  const events: Array<ActivityEvent> = [];

  for (const event of selected) {
    if (nativeIds.has(event.id)) {
      events.push(await nativeEvent(access.harness, event));
    } else {
      events.push(event);
    }
  }

  return { events, hasMore: ordered.length > limit, afterSequence };
}

export async function listConsoleMessages(access: HistoricalView, input: MessagePageInput) {
  const limit = Math.max(1, Math.min(input.maxRows ?? MESSAGE_PAGE_MAX_ROWS, MESSAGE_PAGE_MAX_ROWS));
  const isForward = input.afterSequence !== undefined;

  const bounds = {
    afterSequence: input.afterSequence ?? 0,
    beforeSequence: input.beforeSequence ?? Number.MAX_SAFE_INTEGER,
    maxRows: limit + 1,
    isReversed: !isForward,
  };

  const importedSource: SequenceSource<ConsoleMessage> = {
    count: await ImportedMessagePointers.count(access.harness, BACKGROUND_CONTEXT),
    at: (ordinal) => readImportedMessageAt(access.harness, access.scope, ordinal),
  };

  const nativeSource: SequenceSource<ConsoleMessage> = {
    count: await Messages.count(access.harness, BACKGROUND_CONTEXT),
    at: (ordinal) => Messages.at(access.harness, ordinal, BACKGROUND_CONTEXT),
  };

  const imported = await sequenceRows({ source: importedSource, ...bounds });
  const current = await sequenceRows({ source: nativeSource, ...bounds });
  const ordered = [...imported, ...current].toSorted((left, right) => left.sequence - right.sequence);

  const messages: Array<ConsoleMessage> = (() => {
    if (isForward) {
      return ordered.slice(0, limit);
    }

    return ordered.slice(-limit);
  })();

  return { messages, hasMore: ordered.length > limit, beforeSequence: messages[0]?.sequence ?? null };
}
