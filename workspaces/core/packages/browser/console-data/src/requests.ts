import { MechId, ThreadId, TurnId } from '@mechane/records';
import { Schema } from 'effect';
import { restoreRecord } from './records.ts';

const READ_KIND = {
  Mechs: 'mechs',
  Mech: 'mech',
  Threads: 'threads',
  Memories: 'memories',
  Turns: 'turns',
  Trace: 'trace',
  TurnEvents: 'turnEvents',
  Events: 'events',
  SlackBindings: 'slackBindings',
  SlackDeliveries: 'slackDeliveries',
  Allowance: 'allowance',
} as const;

const ReadId = Schema.String.pipe(Schema.brand('ConsoleReadId'));
type ReadId = typeof ReadId.Type;

const ReadTarget = Schema.Union([
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Mechs), after: Schema.NullOr(Schema.String) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Mech), mechId: MechId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Threads), mechId: MechId, after: Schema.NullOr(ThreadId) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Memories), mechId: MechId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Turns), mechId: MechId, after: Schema.NullOr(TurnId) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Trace), mechId: MechId, turnId: TurnId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.TurnEvents), mechId: MechId, turnId: TurnId, after: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Events), mechId: MechId, before: Schema.NullOr(Schema.Number) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.SlackBindings) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.SlackDeliveries), mechId: MechId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Allowance) }),
]);

type ReadTarget = typeof ReadTarget.Type;

const ReadKind = Schema.Enum(READ_KIND);
/** The fixed API reads supported by the console's exact receipt source. */
export type ReadKind = typeof ReadKind.Type;

/** A declared endpoint and cursor whose serialized identity names one exact demand. */
export type ReadRequest<Kind extends ReadKind = ReadKind> = Extract<ReadTarget, { readonly kind: Kind }> & {
  readonly id: ReadId;
};

/** Ordered membership for one successful API read, including successful empty results. */
export const ReadReceipt = Schema.Struct({
  id: ReadId,
  kind: ReadKind,
  keys: Schema.Array(Schema.String),
  /** Null means the endpoint does not expose pagination metadata. */
  hasMore: Schema.NullOr(Schema.Boolean),
  fetchedAtMs: Schema.toEncoded(Schema.DateTimeUtcFromMillis),
});

export type ReadReceipt = typeof ReadReceipt.Type;

function request<Target extends ReadTarget>(target: Target): Target & { readonly id: ReadId } {
  return { ...target, id: ReadId.make(JSON.stringify(target)) };
}

/** Builds stable read identities before runtime creation or during route navigation. */
export const readRequests = {
  mechs: (after: string | null) => request({ kind: READ_KIND.Mechs, after }),
  mech: (mechId: string) => request({ kind: READ_KIND.Mech, mechId: MechId.make(mechId) }),
  threads: (mechId: string, after: ThreadId | null) =>
    request({ kind: READ_KIND.Threads, mechId: MechId.make(mechId), after }),
  memories: (mechId: string) => request({ kind: READ_KIND.Memories, mechId: MechId.make(mechId) }),
  turns: (mechId: string, after: TurnId | null) =>
    request({ kind: READ_KIND.Turns, mechId: MechId.make(mechId), after }),
  trace: (mechId: string, turnId: TurnId) => request({ kind: READ_KIND.Trace, mechId: MechId.make(mechId), turnId }),
  turnEvents: (mechId: string, turnId: TurnId, after: number) =>
    request({ kind: READ_KIND.TurnEvents, mechId: MechId.make(mechId), turnId, after }),
  events: (mechId: string, before: number | null) =>
    request({ kind: READ_KIND.Events, mechId: MechId.make(mechId), before }),
  slackBindings: () => request({ kind: READ_KIND.SlackBindings }),
  slackDeliveries: (mechId: string) => request({ kind: READ_KIND.SlackDeliveries, mechId: MechId.make(mechId) }),
  allowance: () => request({ kind: READ_KIND.Allowance }),
} as const;

/** Rejects stored identities that do not name one of the declared endpoint demands. */
export function decodeReadRequest(id: string): ReadRequest {
  const target = restoreRecord(Schema.fromJsonString(ReadTarget), id);

  return { ...target, id: ReadId.make(id) };
}
