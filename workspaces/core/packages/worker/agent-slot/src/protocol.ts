import { Schema } from 'effect';

export const AgentSlotScope = Schema.Struct({ workspaceId: Schema.NonEmptyString, agentId: Schema.NonEmptyString });

export type AgentSlotScope = typeof AgentSlotScope.Type;

export type SlotNamespace = DurableObjectNamespace;

export type AgentSlotBindings = Readonly<Record<string, unknown>> & {
  readonly AGENT_SLOTS: SlotNamespace;
  readonly SESSIONS: SlotNamespace;
};

export type ManagedIdentityLease = { readonly epoch: number; readonly signal: AbortSignal };

export type ManagedIdentitySlot = {
  readonly acquire: (signal?: AbortSignal) => Promise<ManagedIdentityLease>;
  readonly epoch: () => Promise<number | null>;
  readonly release: (expectedEpoch: number) => Promise<void>;
};

export const SlotEnvelope = Schema.Struct({
  scope: AgentSlotScope,
  method: Schema.NonEmptyString,
  input: Schema.Unknown,
});

export const SlotAcquireInput = Schema.Struct({
  holderId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
  doName: Schema.NonEmptyString,
  instanceId: Schema.NonEmptyString,
});

export type SlotAcquireInput = typeof SlotAcquireInput.Type;

export const SlotHeartbeatInput = Schema.Struct({
  holderId: Schema.NonEmptyString,
  epoch: Schema.Int.check(Schema.isGreaterThan(0)),
  instanceId: Schema.NonEmptyString,
});

export type SlotHeartbeatInput = typeof SlotHeartbeatInput.Type;

export const SlotReleaseInput = Schema.Struct({
  holderId: Schema.NonEmptyString,
  expectedEpoch: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type SlotReleaseInput = typeof SlotReleaseInput.Type;

export const SlotRecoverInput = Schema.Struct({ holderId: Schema.NonEmptyString, instanceId: Schema.NonEmptyString });

export type SlotRecoverInput = typeof SlotRecoverInput.Type;

export const SlotHolderInput = Schema.Struct({ holderId: Schema.NonEmptyString });

export type SlotHolderInput = typeof SlotHolderInput.Type;

export const SlotAcquireOutput = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('granted'),
    epoch: Schema.Int.check(Schema.isGreaterThan(0)),
    leaseUntilMs: Schema.Int,
  }),
  Schema.Struct({ status: Schema.Literal('queued'), ownerSessionId: Schema.NullOr(Schema.String) }),
]);

export type SlotAcquireOutput = typeof SlotAcquireOutput.Type;

export const SlotHeartbeatOutput = Schema.Union([
  Schema.Struct({ status: Schema.Literal('ok'), leaseUntilMs: Schema.Int }),
  Schema.Struct({ status: Schema.Literal('lost') }),
]);

export type SlotHeartbeatOutput = typeof SlotHeartbeatOutput.Type;

export const SlotEpochOutput = Schema.Struct({ epoch: Schema.NullOr(Schema.Int) });

export type SlotEpochOutput = typeof SlotEpochOutput.Type;

export const SlotAttention = Schema.Struct({
  sessionId: Schema.NullOr(Schema.String),
  queuedSessionIds: Schema.Array(Schema.String),
});

export type SlotAttention = typeof SlotAttention.Type;

export const SlotErrorPayload = Schema.Struct({ reason: Schema.NonEmptyString });
