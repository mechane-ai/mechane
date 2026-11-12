import { Schema } from 'effect';
import { NativeEntryId, NativeSubmissionId, NativeTaskId } from './records.ts';

const NullableText = Schema.NullOr(Schema.String);

export const NotificationRow = Schema.Struct({
  id: Schema.String,
  digest: Schema.String,
  sequence: Schema.Number,
  receivedAt: Schema.String,
  submissionId: NativeSubmissionId,
  turnId: Schema.String,
  value: Schema.String,
});

export const TurnRow = Schema.Struct({
  id: Schema.String,
  sequence: Schema.Number,
  submissionId: NativeSubmissionId,
  taskIds: Schema.Array(NativeTaskId),
  value: Schema.String,
});

export const CancellationRow = Schema.Struct({
  turnId: Schema.String,
  cancelerId: Schema.String,
  requestedAt: Schema.String,
  status: Schema.Literals(['pending', 'completed']),
});

export const ObservationRow = Schema.Struct({
  ids: Schema.Array(Schema.String),
  sequence: Schema.Number,
  turnId: Schema.String,
  cutoff: NativeEntryId,
});

export const EffectRow = Schema.Struct({
  id: Schema.String,
  runId: Schema.String,
  runtimeSource: Schema.Literals(['native', 'imported']),
  kind: Schema.Literals(['sandbox', 'mcp', 'process', 'browser']),
  request: NullableText,
  status: Schema.Literals(['pending', 'running', 'completed', 'uncertain', 'failed']),
  providerId: NullableText,
  result: NullableText,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const ControlChangeRow = Schema.Struct({ id: Schema.String, digest: Schema.String });

export const WakeRow = Schema.Struct({
  id: Schema.String,
  taskId: NativeTaskId,
  digest: Schema.String,
  value: Schema.String,
});

export const RoutineRow = Schema.Struct({
  id: Schema.String,
  taskId: Schema.NullOr(NativeTaskId),
  digest: Schema.String,
  value: Schema.String,
});

export const AttemptRow = Schema.Struct({
  id: Schema.String,
  turnId: Schema.String,
  taskId: Schema.NullOr(Schema.Number),
  ordinal: Schema.Number,
  fingerprint: Schema.String,
  model: Schema.String,
  reservedMicros: Schema.Number,
  phase: Schema.Literals(['intent', 'reserved', 'release', 'dispatched', 'settlement', 'settled', 'refused']),
  refusalReason: NullableText,
  usage: NullableText,
  actualMicros: Schema.NullOr(Schema.Number),
});

export const ExportRow = Schema.Struct({ id: Schema.String, value: Schema.String });

export type NotificationRecord = typeof NotificationRow.Type;
export type TurnRecord = typeof TurnRow.Type;
export type CancellationRecord = typeof CancellationRow.Type;
export type EffectRecord = typeof EffectRow.Type;
export type AttemptRecord = typeof AttemptRow.Type;
