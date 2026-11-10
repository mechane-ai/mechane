import { ModelId } from '@mechane/deployment';
import {
  Bytes,
  MechId,
  memberOrUnknown,
  Micros,
  ModelToolCallId,
  PrincipalId,
  RecordName,
  RecordText,
  renamedWireStruct,
  Sequence,
  Tokens,
  TurnId,
  unknownMember,
  wireStruct,
  WorkspaceId,
} from '@mechane/records';
import { ExecutionId } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { NotificationId } from '../notifications/schemas.ts';
import {
  BashExecutionStatus,
  DispatchStatus,
  SettlementBasis,
  TOOL_TRACE_OUTPUT_MAX_BYTES,
  ToolCallStatus,
  ToolInspectionKind,
  TurnRuntimeSource,
  TurnStatus,
  UnansweredReason,
} from './constants.ts';

/** The path of one turn of a mech. */
export const TurnPath = wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId, turnId: TurnId } });

export type TurnPath = typeof TurnPath.Type;

/** Notifications record what the activation actually received. */
const TURN_FIELDS = {
  id: TurnId,
  runtimeSource: Schema.optionalKey(Schema.Enum(TurnRuntimeSource)),
  version: Schema.Int.check(Schema.isGreaterThan(0)),
  notificationIds: Schema.Array(NotificationId),
  createdAt: WireTime,
  startedAt: Schema.OptionFromNullOr(WireTime),
  definitionRevision: Schema.Int,
  inputExcerpt: Schema.optionalKey(RecordText),
} as const;

/** A bounded activation is execution history, independent of public communication. */
export const Turn = Schema.Union([
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Queued) } }),
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Running) } }),
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Completed), endedAt: WireTime } }),
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Stopped), endedAt: WireTime } }),
  wireStruct({
    fields: {
      ...TURN_FIELDS,
      status: Schema.Literal(TurnStatus.Failed),
      endedAt: WireTime,
      reason: memberOrUnknown({ set: UnansweredReason }),
    },
  }),
]);

export type Turn = typeof Turn.Type;

/** A turn in a status a newer deployment added, which this release does not know, with its other fields as written. */
export const UnknownTurn = Schema.StructWithRest(
  Schema.Struct({ id: TurnId, status: unknownMember({ set: TurnStatus }) }),
  [UnknownFields],
);

export type UnknownTurn = typeof UnknownTurn.Type;

/** A cancel the mech recorded on a turn, when and by whom; the turn ends unanswered, `canceled`, once it stops. */
export const TurnCancel = wireStruct({ fields: { turnId: TurnId, canceledAt: WireTime, cancelerId: PrincipalId } });

export type TurnCancel = typeof TurnCancel.Type;

/** The tokens of each kind a dispatch used, as the upstream reported them; input excludes cached tokens. */
const TokenUsage = Schema.Struct({
  inputTokens: Tokens,
  outputTokens: Tokens,
  cacheReadTokens: Tokens,
  cacheWriteTokens: Tokens,
});

type TokenUsage = typeof TokenUsage.Type;

/** Provider execution identities stay opaque, including archived step and attempt identifiers. */
const ModelDispatchId = Schema.NonEmptyString;

/** The fields of a dispatch in each of its states: its model, the reservation it asked for, and when it was decided. */
const DISPATCH_FIELDS = { id: ModelDispatchId, model: ModelId, requestedMicros: Micros, decidedAt: WireTime } as const;

/** The fields of a settled dispatch: what it was charged, and when. */
const SETTLED_FIELDS = {
  status: Schema.Literal(DispatchStatus.Settled),
  settledMicros: Micros,
  settledAt: WireTime,
} as const;

/**
 * One model request of a turn, reserved against the workspace's allowance before it was sent, or refused unsent. A
 * settled dispatch is priced from the usage the upstream reported, or at its reservation without any.
 */
export const Dispatch = Schema.Union([
  wireStruct({ fields: { ...DISPATCH_FIELDS, status: Schema.Literal(DispatchStatus.Reserved) } }),
  wireStruct({ fields: { ...DISPATCH_FIELDS, status: Schema.Literal(DispatchStatus.Refused) } }),
  wireStruct({
    fields: {
      ...DISPATCH_FIELDS,
      ...SETTLED_FIELDS,
      basis: Schema.Literal(SettlementBasis.Usage),
      ...TokenUsage.fields,
    },
  }),
  wireStruct({ fields: { ...DISPATCH_FIELDS, ...SETTLED_FIELDS, basis: Schema.Literal(SettlementBasis.Reservation) } }),
]);

export type Dispatch = typeof Dispatch.Type;

/** The fields of a dispatch that a newer deployment's status or settlement keeps, as the wire names them. */
const UNKNOWN_DISPATCH_FIELDS = { id: ModelDispatchId, model: ModelId, requested_micros: Micros } as const;

/**
 * A dispatch in a status, or settled on a basis, that a newer deployment added, which this release does not know. It
 * holds what every dispatch carries, and its other fields as the wire wrote them.
 */
export const UnknownDispatch = Schema.Union([
  Schema.StructWithRest(Schema.Struct({ ...UNKNOWN_DISPATCH_FIELDS, status: unknownMember({ set: DispatchStatus }) }), [
    UnknownFields,
  ]),
  Schema.StructWithRest(
    Schema.Struct({
      ...UNKNOWN_DISPATCH_FIELDS,
      status: Schema.Literal(DispatchStatus.Settled),
      basis: unknownMember({ set: SettlementBasis }),
    }),
    [UnknownFields],
  ),
]);

export type UnknownDispatch = typeof UnknownDispatch.Type;

/** A dispatch as a trace lists it: in a status and on a basis this release knows, or a newer deployment's. */
export const TracedDispatch = Schema.Union([Dispatch, UnknownDispatch]);

export type TracedDispatch = typeof TracedDispatch.Type;

/** The trace carries a short excerpt. The indexed event holds the full recorded reply. */
export const REPLY_EXCERPT_MAX_CHARS = 512;

/** The recorded reply prefix with the event sequence that locates its full text. */
const TurnReplyExcerpt = wireStruct({ fields: { sequence: Sequence, text: RecordText, isTruncated: Schema.Boolean } });

type TurnReplyExcerpt = typeof TurnReplyExcerpt.Type;

/** Text retained after execution-time redaction, with bytes omitted by retention and trace preview limits. */
const ToolTraceText = wireStruct({
  fields: {
    text: RecordText.check(
      Schema.makeFilter((text) => new TextEncoder().encode(text).byteLength <= TOOL_TRACE_OUTPUT_MAX_BYTES, {
        expected: `a trace preview of at most ${TOOL_TRACE_OUTPUT_MAX_BYTES} UTF-8 bytes`,
      }),
    ),
    omittedBytes: Bytes,
  },
});

/** Only allowlisted receipt fields are inspectable; absent output differs from a recorded empty output. */
const BashToolResult = renamedWireStruct({
  fields: {
    status: Schema.Enum(BashExecutionStatus),
    exitCode: Schema.OptionFromNullOr(Schema.Int),
    duration: Schema.OptionFromNullOr(Schema.DurationFromMillis),
    output: Schema.OptionFromNullOr(ToolTraceText),
  },
  renames: { duration: 'duration_ms' },
});

/** A missing command has no safe execution-time snapshot, including historical runs. */
const BashToolInspection = wireStruct({
  fields: {
    kind: Schema.Literal(ToolInspectionKind.Bash),
    executionId: Schema.optionalKey(ExecutionId),
    command: Schema.OptionFromNullOr(ToolTraceText),
    result: Schema.OptionFromNullOr(BashToolResult),
  },
});

/** Safe command evidence is separate from the SDK's tool completion state. Raw arguments are never projected. */
export const TurnToolCall = wireStruct({
  fields: {
    id: ModelToolCallId,
    name: RecordName,
    status: Schema.Enum(ToolCallStatus),
    /** Absent when the result does not record a tool duration. */
    startedAt: Schema.OptionFromNullOr(WireTime),
    /** Absent until a tool result is committed. */
    endedAt: Schema.OptionFromNullOr(WireTime),
    /** Unknown tool kinds expose only execution metadata. */
    inspection: Schema.optionalKey(BashToolInspection),
  },
});

export type TurnToolCall = typeof TurnToolCall.Type;

/** A turn with its dispatches in decision order and its recorded reply when available. */
export const Trace = wireStruct({
  fields: {
    turn: Schema.Union([Turn, UnknownTurn]),
    dispatches: Schema.Array(TracedDispatch),
    /** Absent while unanswered or when the deployment cannot read a recorded reply. */
    replyExcerpt: Schema.OptionFromOptionalKey(TurnReplyExcerpt),
    /** Absent when the serving deployment does not expose tool evidence. */
    toolCalls: Schema.optionalKey(Schema.Array(TurnToolCall)),
    /** Absent when the serving deployment does not expose evidence notices. */
    evidenceNotices: Schema.optionalKey(Schema.Array(RecordText)),
  },
});

export type Trace = typeof Trace.Type;
