import {
  BYTES_PER_KIBIBYTE,
  CreationRequestRecordId,
  MechId,
  PrincipalId,
  RecordId,
  RecordText,
  Sequence,
  SHA256_PATTERN,
  TurnId,
  WorkspaceId,
} from '@mechane/records';
import { SandboxCompletion } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { NotificationId, RecordedNotificationSource } from '../operations/notifications/schemas.ts';
import { UnknownFields } from '../schemas.ts';

/** Service-authenticated route for binding retained source history to one mech actor. */
export const MECH_HISTORY_IMPORT_PATH = '/internal/mechs/import';
/** Maximum serialized source batch emitted by the importer before actor admission. */
export const MECH_HISTORY_IMPORT_BATCH_MAX_BYTES = 512 * BYTES_PER_KIBIBYTE;
/** Maximum HTTP request body accepted at the service-authenticated import boundary. */
export const MECH_HISTORY_IMPORT_BODY_MAX_BYTES = 1024 * BYTES_PER_KIBIBYTE;

/** Archive tags identify source records without making their historical tool calls executable. */
export const MechHistorySourceKind = {
  Context: 'source_context',
  Manifest: 'source_manifest',
  Run: 'source_run',
  Activity: 'source_activity',
  Publication: 'source_publication',
  Notification: 'source_notification',
  Execution: 'source_execution',
  Completion: 'source_completion',
  Memory: 'source_memory',
  WorkItem: 'source_work_item',
  Retirement: 'source_retirement',
} as const;

/** Complete scoped terminal receipt retained as JSON without creating a historical run or effect. */
export const SourceCompletion = Schema.toEncoded(SandboxCompletion);
export type SourceCompletion = typeof SourceCompletion.Type;
const ProducerKind = { Member: 'member', Producer: 'producer' } as const;
const ExecutionKind = { Sandbox: 'sandbox', Mcp: 'mcp', Process: 'process', Browser: 'browser' } as const;

const ExecutionStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Uncertain: 'uncertain',
  Failed: 'failed',
} as const;

const StoredTime = Schema.NonEmptyString;
/** The import keeps original JSON primitives so decoding cannot change archived batch identity. */
const NullableTime = Schema.NullOr(StoredTime);
const SourceDigest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));
const ImportedProducerId = RecordText.pipe(Schema.brand('ImportedProducerId'));
const ImportedExecutionId = RecordId.pipe(Schema.brand('ImportedExecutionId'));
const ImportedProviderId = RecordText.pipe(Schema.brand('ImportedProviderId'));
const ImportedSource = Schema.StructWithRest(RecordedNotificationSource, [UnknownFields]);

const ImportedProducer = Schema.Union([
  Schema.StructWithRest(Schema.Struct({ kind: Schema.Literal(ProducerKind.Member), principalId: PrincipalId }), [
    UnknownFields,
  ]),
  Schema.StructWithRest(Schema.Struct({ kind: Schema.Literal(ProducerKind.Producer), id: ImportedProducerId }), [
    UnknownFields,
  ]),
]);

const ImportedNotification = Schema.Struct({
  id: NotificationId,
  workspaceId: WorkspaceId,
  mechId: MechId,
  receivedSequence: Sequence,
  receivedAt: StoredTime,
  text: RecordText,
  source: ImportedSource,
  producer: ImportedProducer,
  /** Null when the source notice retained no additional producer payload. */
  // oxlint-disable-next-line id-denylist -- The persisted notification field must survive the import unchanged.
  data: Schema.NullOr(UnknownFields),
});

const ImportedExecution = Schema.Struct({
  id: ImportedExecutionId,
  runId: TurnId,
  kind: Schema.Enum(ExecutionKind),
  /** Null when the source receipt retained no immutable request payload. */
  request: Schema.NullOr(UnknownFields),
  status: Schema.Enum(ExecutionStatus),
  /** Null when the source recorded no provider execution handle. */
  providerId: Schema.NullOr(ImportedProviderId),
  /** Null when the source retained no confirmed execution result. */
  result: Schema.NullOr(UnknownFields),
  createdAt: StoredTime,
  updatedAt: StoredTime,
});

const ImportedContext = Schema.Struct({
  receivedSequence: Sequence,
  presentedSequence: Sequence,
  isEnvironmentCheckpointRequired: Schema.Boolean,
  /** Null when no note-import event was recorded in the source context. */
  notesImportedAt: NullableTime,
  isContextInitialized: Schema.Boolean,
  modelMessages: Schema.Array(UnknownFields),
});

const BATCH_FIELDS = {
  requestId: CreationRequestRecordId,
  sourceDigest: SourceDigest,
  expectedSequence: Sequence,
  sourceSequence: Sequence,
  /** Null when no separate summary seed is supplied; context may still carry source messages. */
  workingContext: Schema.NullOr(RecordText),
  /** Null when this batch carries no retained working-context snapshot. */
  context: Schema.NullOr(ImportedContext),
  notifications: Schema.Array(ImportedNotification),
  executions: Schema.Array(ImportedExecution),
  history: Schema.Array(UnknownFields),
  isFinal: Schema.Boolean,
} as const;

/** One immutable source batch whose ordered acceptance keeps imported execution quiescent. */
export const MechHistoryImportBatch = Schema.Struct(BATCH_FIELDS);
export type MechHistoryImportBatch = typeof MechHistoryImportBatch.Type;
/** A source history batch bound to exactly one target workspace and mech. */
export const MechHistoryImport = Schema.Struct({ workspaceId: WorkspaceId, mechId: MechId, ...BATCH_FIELDS });
export type MechHistoryImport = typeof MechHistoryImport.Type;

/** Durable cursor for retrying the same source manifest after a lost acknowledgment. */
export const MechHistoryImportReceipt = Schema.Struct({
  sourceDigest: SourceDigest,
  sourceSequence: Sequence,
  isFinal: Schema.Boolean,
});

export type MechHistoryImportReceipt = typeof MechHistoryImportReceipt.Type;
