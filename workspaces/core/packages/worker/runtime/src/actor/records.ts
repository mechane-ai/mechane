import { isJsonValue } from '@earendil-works/chord/json';
import type { Id } from '@earendil-works/pi-durable';
import { Schema } from 'effect';

function nativeId<Kind extends string>(kind: Kind): Schema.declare<Id<Kind>> {
  return Schema.declare<Id<Kind>>(
    // Pi exposes nominal IDs without a public decoder; retained IDs must be positive safe integers.
    // ast-grep-ignore: type-predicate
    (value): value is Id<Kind> => typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    { title: `Pi ${kind} ID` },
  );
}

export const NativeEntryId = nativeId('entry');
export const NativeSubmissionId = nativeId('submission');
export const NativeTaskId = nativeId('task');

export const NativeFields = Schema.declare(isJsonValue).pipe(
  Schema.decodeTo(Schema.Record(Schema.String, Schema.declare(isJsonValue))),
);

const Fields = Schema.Record(Schema.String, Schema.Unknown);
const NullableText = Schema.NullOr(Schema.String);
const Scope = Schema.Struct({ workspaceId: Schema.String, mechId: Schema.String });

const RunFields = Schema.Struct({
  id: Schema.String,
  ...Scope.fields,
  sessionId: Schema.String,
  inputId: Schema.String,
  notificationIds: Schema.Array(Schema.String),
  definitionRevision: Schema.Number,
  status: Schema.Literals(['queued', 'running', 'waiting', 'completed', 'failed', 'cancelled']),
  version: Schema.Number,
  inputText: Schema.String,
  attachments: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      mediaType: NullableText,
      sizeBytes: Schema.NullOr(Schema.Number),
      url: NullableText,
    }),
  ),
  origin: Schema.Union([
    Schema.Struct({ kind: Schema.Literal('notification'), notificationId: NullableText }),
    Schema.Struct({ kind: Schema.Literals(['console', 'api']), principalId: Schema.String }),
    Schema.Struct({
      kind: Schema.Literal('slack'),
      teamId: Schema.String,
      channelId: Schema.String,
      threadId: Schema.String,
      messageId: Schema.String,
      userId: Schema.String,
      bindingId: Schema.String,
      installationId: Schema.String,
    }),
  ]),
  createdAt: Schema.String,
  startedAt: NullableText,
  endedAt: NullableText,
  error: NullableText,
  failureReason: Schema.NullOr(Schema.Literals(['allowance_exhausted', 'faulted'])),
  reply: NullableText,
  cancelRequestedAt: NullableText,
});

const HistoricalOrigin = Schema.Union([
  RunFields.fields.origin,
  Schema.Struct({ kind: Schema.Literals(['console', 'api']), principalId: Schema.optionalKey(Schema.String) }),
]);

const NativeRunRecord = Schema.Struct({
  ...RunFields.fields,
  runtimeSource: Schema.optionalKey(Schema.Literal('native')),
});

export const ImportedRunRecord = Schema.Struct({
  ...RunFields.fields,
  runtimeSource: Schema.Literal('imported'),
  origin: HistoricalOrigin,
});

export const RunRecord = Schema.Union([NativeRunRecord, ImportedRunRecord]);

export const ActivityRecord = Schema.Struct({
  id: Schema.String,
  sequence: Schema.Number,
  ...Scope.fields,
  runId: NullableText,
  type: Schema.String,
  payload: Fields,
  createdAt: Schema.String,
});

export const MessageRecord = Schema.Struct({
  id: Schema.String,
  ...Scope.fields,
  runId: NullableText,
  sequence: Schema.Number,
  role: Schema.Literals(['user', 'assistant']),
  text: Schema.String,
  presentation: Schema.NullOr(Fields),
  createdAt: Schema.String,
});

export const WakeRecord = Schema.Struct({
  id: Schema.String,
  mechId: Schema.String,
  status: Schema.Literals(['scheduled', 'cancelled', 'delivered']),
  text: Schema.String,
  createdAt: Schema.String,
  dueAt: Schema.String,
  canceledAt: NullableText,
  deliveredAt: NullableText,
  notificationId: NullableText,
});

export const NotificationRecord = Schema.Struct({
  id: Schema.String,
  ...Scope.fields,
  receivedSequence: Schema.Number,
  receivedAt: Schema.String,
  text: Schema.String,
  source: Schema.Struct({ name: Schema.String, eventId: Schema.String, url: Schema.optionalKey(Schema.String) }),
  producer: Schema.Union([
    Schema.Struct({ kind: Schema.Literal('member'), principalId: Schema.String }),
    Schema.Struct({ kind: Schema.Literal('producer'), id: Schema.String }),
  ]),
  data: Schema.NullOr(Fields),
});

export const NotificationReceiptRecord = Schema.Struct({
  id: Schema.String,
  mechId: Schema.String,
  receivedAt: Schema.String,
  receivedSequence: Schema.Number,
  wasCreated: Schema.Boolean,
});

export const StatusRecord = Schema.Struct({
  ...Scope.fields,
  activeRevision: Schema.Number,
  turnId: NullableText,
  status: Schema.Literals(['idle', 'running', 'paused', 'quiesced']),
  admittedSequence: Schema.Number,
  observedSequence: Schema.Number,
});

export const CancellationRecord = Schema.Struct({ cancelerId: Schema.String, canceledAt: Schema.String });

export const ExportRecord = Schema.Struct({
  version: Schema.Literal(1),
  source: Scope,
  exportedAt: Schema.String,
  sourceSequence: Schema.Number,
  definitionRevision: Schema.Number,
  context: Schema.String,
});

export const SpendRecord = Schema.Struct({
  id: Schema.String,
  runId: Schema.String,
  ...Scope.fields,
  model: Schema.String,
  reservedMicros: Schema.Number,
  settledMicros: Schema.NullOr(Schema.Number),
  usage: Schema.NullOr(
    Schema.Struct({
      inputTokens: Schema.Number,
      outputTokens: Schema.Number,
      cacheReadTokens: Schema.Number,
      cacheWriteTokens: Schema.Number,
    }),
  ),
  state: Schema.Literals(['reserved', 'settled', 'refused']),
  createdAt: Schema.String,
  settledAt: NullableText,
});

export const TraceRecord = Schema.Struct({
  run: RunRecord,
  events: Schema.Array(ActivityRecord),
  dispatches: Schema.Array(SpendRecord),
  toolCalls: Schema.Array(Schema.Unknown),
  evidenceNotices: Schema.Array(Schema.String),
});

export function decodeStored<T>(schema: Schema.Codec<T, unknown>, value: string): T {
  return Schema.decodeUnknownSync(schema)(JSON.parse(value));
}

export const StoredFields = Fields;
