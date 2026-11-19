import { Schema } from 'effect';
import { ManagedEvent, ManagedSessionOpen, ManagedWireObject } from '../protocol.ts';

export const ManagedDelegationOrigin = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  agentId: Schema.NonEmptyString,
  childAgentId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
  threadId: Schema.NonEmptyString,
  parentThreadId: Schema.NonEmptyString,
  callId: Schema.NonEmptyString,
});

export type ManagedDelegationOrigin = typeof ManagedDelegationOrigin.Type;

export const ManagedDelegationBudgetUpdate = Schema.Struct({
  origin: ManagedDelegationOrigin,
  revision: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type ManagedDelegationBudgetUpdate = typeof ManagedDelegationBudgetUpdate.Type;

export const ManagedDelegationLeaseLoss = Schema.Struct({
  origin: ManagedDelegationOrigin,
  leaseId: Schema.NonEmptyString,
  toolUseId: Schema.NullOr(Schema.NonEmptyString),
});

export type ManagedDelegationLeaseLoss = typeof ManagedDelegationLeaseLoss.Type;

export const ManagedDelegationOpen = Schema.Struct({ origin: ManagedDelegationOrigin, session: ManagedSessionOpen });
export type ManagedDelegationOpen = typeof ManagedDelegationOpen.Type;

export const ManagedDelegationRead = Schema.Struct({
  origin: ManagedDelegationOrigin,
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type ManagedDelegationRead = typeof ManagedDelegationRead.Type;

export const ManagedDelegationPage = Schema.Struct({
  isBudgetPaused: Schema.optional(Schema.Literal(true)),
  waitingForClientToolUseId: Schema.optional(Schema.NonEmptyString),
  deliveries: Schema.optional(Schema.Record(Schema.String, Schema.NonEmptyString)),
  data: Schema.Array(ManagedEvent),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type ManagedDelegationPage = typeof ManagedDelegationPage.Type;

export const ManagedDelegationSend = Schema.Struct({
  origin: ManagedDelegationOrigin,
  deliveryId: Schema.NonEmptyString,
  events: Schema.Array(ManagedWireObject),
});

export type ManagedDelegationSend = typeof ManagedDelegationSend.Type;
