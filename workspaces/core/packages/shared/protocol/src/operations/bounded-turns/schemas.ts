import { ModelId } from '@mechane/deployment';
import {
  BoundedRequestId,
  BoundedRequestRecordId,
  DispatchId,
  MechId,
  ModelToolCallId,
  RecordText,
  Tokens,
  TurnId,
  wireStruct,
  WorkspaceId,
} from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { InboxText } from '../inbox/schemas.ts';
import { Dispatch } from '../turns/schemas.ts';
import {
  BOUNDED_TURN_MAX_DISPATCHES,
  BOUNDED_TURN_MAX_OUTPUT_TOKENS,
  BoundedCallStatus,
  BoundedTurnStatus,
} from './constants.ts';

/** The admitted workspace and mech scope the caller's retry identity. */
export const BoundedTurnPath = wireStruct({
  fields: { workspaceId: WorkspaceId, mechId: MechId, requestId: BoundedRequestId },
});

/** A retried submission must preserve its original text and execution limits. */
export const BoundedTurnSubmission = wireStruct({
  fields: {
    text: InboxText,
    maxModelDispatches: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: BOUNDED_TURN_MAX_DISPATCHES })),
    maxOutputTokens: Tokens.check(Schema.isBetween({ minimum: 1, maximum: BOUNDED_TURN_MAX_OUTPUT_TOKENS })),
    deadlineAt: WireTime,
  },
});

export type BoundedTurnSubmission = typeof BoundedTurnSubmission.Type;

/** Request and response bodies contain provider evidence, never transport credentials. */
export const BOUNDED_DISPATCH_EVIDENCE_FIELDS = {
  id: DispatchId,
  model: ModelId,
  status: Schema.Enum(BoundedCallStatus),
  request: Schema.Json,
  /** Absent until a response arrives, or when the provider result was lost. */
  response: Schema.OptionFromOptionalKey(Schema.Json),
  startedAt: WireTime,
  /** Absent while the dispatch remains open. */
  endedAt: Schema.OptionFromOptionalKey(WireTime),
} as const;

/** One captured provider exchange is tied to its ledger dispatch identity. */
export const BoundedDispatchEvidence = wireStruct({ fields: BOUNDED_DISPATCH_EVIDENCE_FIELDS });

export type BoundedDispatchEvidence = typeof BoundedDispatchEvidence.Type;

/** Unknown times remain absent when Pi did not retain them. */
export const BoundedToolCall = wireStruct({
  fields: {
    id: ModelToolCallId,
    name: RecordText,
    input: Schema.Json,
    /** Absent when Pi retained no result for this tool request. */
    output: Schema.OptionFromOptionalKey(Schema.Json),
    status: Schema.Literals([BoundedCallStatus.Completed, BoundedCallStatus.Failed, BoundedCallStatus.Unknown]),
    /** Absent when Pi retained no start time for the tool request. */
    startedAt: Schema.OptionFromOptionalKey(WireTime),
    /** Absent when the result or its completion time was not retained. */
    endedAt: Schema.OptionFromOptionalKey(WireTime),
  },
});

export type BoundedToolCall = typeof BoundedToolCall.Type;

/** A durable receipt retains the outcome and evidence of one bounded inbox submission. */
export const BoundedTurn = wireStruct({
  fields: {
    requestId: BoundedRequestRecordId,
    status: Schema.Enum(BoundedTurnStatus),
    receivedAt: WireTime,
    deadlineAt: WireTime,
    maxModelDispatches: Schema.Int,
    maxOutputTokens: Tokens,
    dispatchedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    /** Absent before the inbox item starts a turn. */
    turnId: Schema.OptionFromOptionalKey(TurnId),
    /** Absent while the submission has no terminal outcome. */
    endedAt: Schema.OptionFromOptionalKey(WireTime),
    /** Absent until the submission finishes with a recorded answer. */
    reply: Schema.OptionFromOptionalKey(RecordText),
    /** Absent when no failure, cancellation, or exhausted limit was recorded. */
    reason: Schema.OptionFromOptionalKey(RecordText),
    isEvidenceComplete: Schema.Boolean,
    dispatches: Schema.Array(Dispatch),
    dispatchEvidence: Schema.Array(BoundedDispatchEvidence),
    toolCalls: Schema.Array(BoundedToolCall),
    unknowns: Schema.Array(RecordText),
  },
});

export type BoundedTurn = typeof BoundedTurn.Type;
