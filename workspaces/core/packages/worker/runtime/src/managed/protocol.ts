import { Schema } from 'effect';

export const ManagedWireObject = Schema.Record(Schema.String, Schema.Unknown);
export type ManagedWireObject = typeof ManagedWireObject.Type;

export const ManagedAgentScope = Schema.Struct({ workspaceId: Schema.NonEmptyString, agentId: Schema.NonEmptyString });
export type ManagedAgentScope = typeof ManagedAgentScope.Type;

export const ManagedSessionReference = Schema.Struct({ sessionId: Schema.NonEmptyString });
export type ManagedSessionReference = typeof ManagedSessionReference.Type;

export const ManagedSessionThreadReference = Schema.Struct({
  ...ManagedSessionReference.fields,
  threadId: Schema.NonEmptyString,
});

export type ManagedSessionThreadReference = typeof ManagedSessionThreadReference.Type;

export const ManagedEventScope = Schema.Struct({
  ...ManagedSessionReference.fields,
  threadId: Schema.optional(Schema.NonEmptyString),
  workerLeaseId: Schema.optional(Schema.NonEmptyString),
});

export type ManagedEventScope = typeof ManagedEventScope.Type;

export const ManagedSessionOpen = Schema.Struct({
  ...ManagedSessionThreadReference.fields,
  runtimeMechId: Schema.NonEmptyString,
  environmentId: Schema.NonEmptyString,
  agent: ManagedWireObject,
  creatorId: Schema.NonEmptyString,
  mcpServers: Schema.optional(Schema.Array(ManagedWireObject)),
  childRuntimeMechIds: Schema.optional(Schema.Record(Schema.String, Schema.NonEmptyString)),
  multiagent: Schema.optional(Schema.NullOr(ManagedWireObject)),
  createdAt: Schema.optional(Schema.String),
  model: Schema.NonEmptyString,
  system: Schema.String,
  memoryInstructions: Schema.optional(Schema.String),
  skillInstructions: Schema.optional(Schema.String),
  childSkillInstructions: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  tools: Schema.Array(ManagedWireObject),
  initialEvents: Schema.Array(ManagedWireObject),
});

export type ManagedSessionOpen = typeof ManagedSessionOpen.Type;

export const ManagedSessionSend = Schema.Struct({
  ...ManagedEventScope.fields,
  events: Schema.Array(ManagedWireObject),
});

export type ManagedSessionSend = typeof ManagedSessionSend.Type;

export const ManagedEvent = Schema.StructWithRest(
  Schema.Struct({ id: Schema.NonEmptyString, type: Schema.NonEmptyString, processed_at: Schema.NullOr(Schema.String) }),
  [ManagedWireObject],
);

export type ManagedEvent = typeof ManagedEvent.Type;

export const ManagedSessionStatus = Schema.Literals(['idle', 'running', 'terminated']);
const ThreadStatusFilter = Schema.Union([ManagedSessionStatus, Schema.Literal('rescheduling')]);

export const ManagedSessionState = Schema.Struct({
  status: ManagedSessionStatus,
  stop_reason: Schema.NullOr(ManagedWireObject),
  primary_thread_id: Schema.NonEmptyString,
  outcome_evaluations: Schema.optional(Schema.Array(ManagedWireObject)),
});

export type ManagedSessionState = typeof ManagedSessionState.Type;

const PageSize = Schema.Int.check(Schema.isGreaterThan(0));

export const ManagedEventPageInput = Schema.Struct({
  ...ManagedEventScope.fields,
  afterId: Schema.optional(Schema.NonEmptyString),
  beforeId: Schema.optional(Schema.NonEmptyString),
  limit: Schema.optional(PageSize),
  order: Schema.optional(Schema.Literals(['asc', 'desc'])),
  types: Schema.optional(Schema.Array(Schema.String)),
  createdAfter: Schema.optional(Schema.String),
  createdAfterExclusive: Schema.optional(Schema.String),
  createdBefore: Schema.optional(Schema.String),
  createdBeforeExclusive: Schema.optional(Schema.String),
});

export type ManagedEventPageInput = typeof ManagedEventPageInput.Type;

export const ManagedEventPage = Schema.Struct({
  data: Schema.Array(ManagedEvent),
  has_more: Schema.Boolean,
  first_id: Schema.NullOr(Schema.String),
  last_id: Schema.NullOr(Schema.String),
});

export type ManagedEventPage = typeof ManagedEventPage.Type;

export const ManagedSessionThread = Schema.StructWithRest(
  Schema.Struct({ type: Schema.Literal('session_thread'), id: Schema.NonEmptyString, status: ManagedSessionStatus }),
  [ManagedWireObject],
);

export type ManagedSessionThread = typeof ManagedSessionThread.Type;

export const ManagedThreadPageInput = Schema.Struct({
  ...ManagedSessionReference.fields,
  afterId: Schema.optional(Schema.NonEmptyString),
  limit: Schema.optional(PageSize),
  statuses: Schema.optional(Schema.Array(ThreadStatusFilter)),
});

export type ManagedThreadPageInput = typeof ManagedThreadPageInput.Type;

export const ManagedThreadPage = Schema.Struct({
  data: Schema.Array(ManagedSessionThread),
  has_more: Schema.Boolean,
  first_id: Schema.NullOr(Schema.String),
  last_id: Schema.NullOr(Schema.String),
});

export type ManagedThreadPage = typeof ManagedThreadPage.Type;

export const ManagedStreamRequest = Schema.Struct({
  ...ManagedEventScope.fields,
  eventDeltas: Schema.optional(Schema.Array(Schema.Literals(['agent.message', 'agent.thinking']))),
});

export type ManagedStreamInput = typeof ManagedStreamRequest.Type & { readonly signal?: AbortSignal | undefined };

export const ManagedSessionMutation = Schema.Struct({
  ...ManagedSessionReference.fields,
  mutationId: Schema.NonEmptyString,
  principalId: Schema.NonEmptyString,
  isAdmin: Schema.Boolean,
  kind: Schema.Literals(['update', 'archive', 'delete']),
  changes: Schema.optional(ManagedWireObject),
});

export type ManagedSessionMutation = typeof ManagedSessionMutation.Type;

export const ManagedWorkerLease = Schema.Struct({ ...ManagedSessionReference.fields, leaseId: Schema.NonEmptyString });
export type ManagedWorkerLease = typeof ManagedWorkerLease.Type;
