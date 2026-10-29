import { ModelId } from '@mechane/deployment';
import {
  DispatchId,
  memberOrUnknown,
  Micros,
  RecordId,
  Tokens,
  TurnId,
  unknownMember,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { DispatchStatus, SettlementBasis, TurnStatus, UnansweredReason } from './constants.ts';

/** The path of one turn of a mech. */
export const TurnPath = wireStruct({ fields: { workspaceId: RecordId, mechId: RecordId, turnId: TurnId } });

export type TurnPath = typeof TurnPath.Type;

/** The fields of a turn in each of its states: the inbox items it took up, and when it started. */
const TURN_FIELDS = {
  id: TurnId,
  inboxItemIds: Schema.Array(RecordId),
  startedAt: WireTime,
  definitionRevision: Schema.Int,
} as const;

/** One turn of a mech's work, from its inbox items to its reply or its reason for none. */
export const Turn = Schema.Union([
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Running) } }),
  wireStruct({ fields: { ...TURN_FIELDS, status: Schema.Literal(TurnStatus.Answered), endedAt: WireTime } }),
  wireStruct({
    fields: {
      ...TURN_FIELDS,
      status: Schema.Literal(TurnStatus.Unanswered),
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
export const TurnCancel = wireStruct({ fields: { turnId: TurnId, canceledAt: WireTime, cancelerId: RecordId } });

export type TurnCancel = typeof TurnCancel.Type;

/** The tokens of each kind a dispatch used, as the upstream reported them; input excludes cached tokens. */
export const TokenUsage = Schema.Struct({
  inputTokens: Tokens,
  outputTokens: Tokens,
  cacheReadTokens: Tokens,
  cacheWriteTokens: Tokens,
});

export type TokenUsage = typeof TokenUsage.Type;

/** The fields of a dispatch in each of its states: its model, the reservation it asked for, and when it was decided. */
const DISPATCH_FIELDS = { id: DispatchId, model: ModelId, requestedMicros: Micros, decidedAt: WireTime } as const;

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
const UNKNOWN_DISPATCH_FIELDS = { id: DispatchId, model: ModelId, requested_micros: Micros } as const;

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

/** A turn and its dispatches, in the order they were decided. */
export const Trace = Schema.Struct({
  turn: Schema.Union([Turn, UnknownTurn]),
  dispatches: Schema.Array(TracedDispatch),
});

export type Trace = typeof Trace.Type;
