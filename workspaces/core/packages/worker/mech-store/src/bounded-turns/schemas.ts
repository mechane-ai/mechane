import { BOUNDED_DISPATCH_EVIDENCE_FIELDS, BoundedCallStatus } from '@mechane/protocol';
import {
  BoundedRequestRecordId,
  DispatchId,
  PrincipalId,
  RecordText,
  renamedWireStruct,
  Tokens,
  TurnId,
} from '@mechane/records';
import { Schema } from 'effect';

/** The bounded receipt joins its execution state from the original inbox item. */
export const BoundedTurnRow = renamedWireStruct({
  fields: {
    requestId: BoundedRequestRecordId,
    maxModelDispatches: Schema.Int,
    maxOutputTokens: Tokens,
    deadlineAt: Schema.DateTimeUtcFromMillis,
    dispatchedCount: Schema.Int,
    /** Absent until a cancellation, limit, or unsuccessful turn records a reason. */
    reason: Schema.OptionFromNullOr(RecordText),
    /** Absent while the submission has no terminal outcome. */
    endedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    /** Absent when the submission has not finished with an answer. */
    reply: Schema.OptionFromNullOr(RecordText),
    /** Absent before the inbox item enters a turn. */
    turnId: Schema.OptionFromNullOr(TurnId),
    text: RecordText,
    senderId: PrincipalId,
    receivedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { deadlineAt: 'deadline_at_ms', endedAt: 'ended_at_ms', receivedAt: 'received_at_ms' },
});

export type BoundedTurnRow = typeof BoundedTurnRow.Type;

/** Stored JSON is decoded here before evidence leaves its owning store. */
export const DispatchEvidenceRow = renamedWireStruct({
  fields: {
    id: DispatchId,
    requestId: BoundedRequestRecordId,
    model: BOUNDED_DISPATCH_EVIDENCE_FIELDS.model,
    status: Schema.Enum(BoundedCallStatus),
    request: Schema.fromJsonString(Schema.Json),
    isPayloadCaptured: Schema.BooleanFromBit,
    /** Absent while waiting for a response, or when the response was lost. */
    response: Schema.OptionFromNullOr(Schema.fromJsonString(Schema.Json)),
    startedAt: Schema.DateTimeUtcFromMillis,
    /** Absent until settlement or a recovered interruption closes the record. */
    endedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
  renames: {
    request: 'request_json',
    response: 'response_json',
    isPayloadCaptured: 'is_payload_captured',
    startedAt: 'started_at_ms',
    endedAt: 'ended_at_ms',
  },
});

export type DispatchEvidenceRow = typeof DispatchEvidenceRow.Type;
