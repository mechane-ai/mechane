import { ModelId } from '@mechane/deployment';
import { DispatchStatus, Instructions, MECH_SUMMARY_RECORD_FIELDS, MechName, SettlementBasis } from '@mechane/protocol';
import { DispatchId, MechId, Micros, PrincipalId, Tokens, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { ForkPointRecord } from './mech.schemas.ts';

/**
 * A mech as the workspace's object indexes and answers it, which decodes into the wire's mech summary. The RPC sends it
 * encoded, its creation time in epoch milliseconds and its fork point as null for a new mech.
 */
export const MechSummaryRecord = Schema.Struct({
  ...MECH_SUMMARY_RECORD_FIELDS,
  /** The mech and sequence it was forked from, none for a mech created new. */
  forkedFrom: Schema.OptionFromNullOr(ForkPointRecord),
}).pipe(Schema.encodeKeys({ createdAt: 'createdAtMs' }));

export type MechSummaryRecord = typeof MechSummaryRecord.Type;

const MechCreationSeed = Schema.Struct({
  workspaceId: WorkspaceId,
  mechId: MechId,
  name: MechName,
  model: ModelId,
  instructions: Schema.OptionFromNullOr(Instructions),
  creatorId: PrincipalId,
  dailyCapMicros: Micros,
});

/** A retry reuses its saved creation seed or conflicts with the original definition. */
export const MechCreationAnswer = Schema.TaggedUnion({
  Prepared: { seed: Schema.fromJsonString(MechCreationSeed) },
  Conflicting: {},
});

export type MechCreationAnswer = typeof MechCreationAnswer.Type;

/**
 * A page of the workspace's mechs as its object answers it, oldest first, which decodes into the wire's page, or a
 * cursor that names no mech of the workspace.
 */
export const MechSummaryPage = Schema.TaggedUnion({
  Listed: { mechs: Schema.Array(MechSummaryRecord), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type MechSummaryPage = typeof MechSummaryPage.Type;

/** What the current UTC day's dispatches have committed in the whole workspace, settled and reserved. */
export const CommittedToday = Schema.Struct({ day: Schema.String, committedMicros: Micros });

export type CommittedToday = typeof CommittedToday.Type;

/** The fields of a dispatch in each of its states, with its decision's time as epoch milliseconds. */
const DISPATCH_RECORD_FIELDS = {
  id: DispatchId,
  model: Schema.String,
  requestedMicros: Micros,
  decidedAt: Schema.DateTimeUtcFromMillis,
} as const;

/** The workspace's decision on a machine: the sandbox holds its lease, or the workspace runs every machine it may. */
export const LeaseDecision = Schema.TaggedUnion({ Leased: {}, Full: {} });

export type LeaseDecision = typeof LeaseDecision.Type;

const RECORD_TIME_KEYS = { decidedAt: 'decidedAtMs', settledAt: 'settledAtMs' } as const;

/** The ledger's decision on a dispatch: its reservation fits the day's allowance and is held, or it does not. */
export const ReservationDecision = Schema.TaggedUnion({ Granted: {}, Refused: {} });

export type ReservationDecision = typeof ReservationDecision.Type;

/** The fields of a settled dispatch: what it was charged, and when. */
const SETTLED_RECORD_FIELDS = {
  status: Schema.Literal(DispatchStatus.Settled),
  settledMicros: Micros,
  settledAt: Schema.DateTimeUtcFromMillis,
} as const;

/**
 * One turn's or drone's dispatches as the ledger answers them, each a row whose unsettled fields are null, which decode
 * into the wire's dispatches by status and basis.
 */
export const WorkDispatchesAnswer = Schema.Array(
  Schema.Union([
    Schema.Struct({ ...DISPATCH_RECORD_FIELDS, status: Schema.Literal(DispatchStatus.Reserved) }).pipe(
      Schema.encodeKeys(RECORD_TIME_KEYS),
    ),
    Schema.Struct({ ...DISPATCH_RECORD_FIELDS, status: Schema.Literal(DispatchStatus.Refused) }).pipe(
      Schema.encodeKeys(RECORD_TIME_KEYS),
    ),
    Schema.Struct({
      ...DISPATCH_RECORD_FIELDS,
      ...SETTLED_RECORD_FIELDS,
      basis: Schema.Literal(SettlementBasis.Usage),
      inputTokens: Tokens,
      outputTokens: Tokens,
      cacheReadTokens: Tokens,
      cacheWriteTokens: Tokens,
    }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
    Schema.Struct({
      ...DISPATCH_RECORD_FIELDS,
      ...SETTLED_RECORD_FIELDS,
      basis: Schema.Literal(SettlementBasis.Reservation),
    }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
  ]),
);

export type WorkDispatchesAnswer = typeof WorkDispatchesAnswer.Type;
