import { DirectoryPrincipal, Micros, PrincipalId, wireStruct } from '@mechane/records';
import { Schema, Struct } from 'effect';
import { KeyPurpose } from '../operations/auth/constants.ts';
import { MechStatus } from '../operations/mechs/constants.ts';
import { DispatchStatus, SettlementBasis } from '../operations/turns/constants.ts';

/** The versioned definition shared by stored rows and object answers. */
export const MECH_DEFINITION_FIELDS = {
  name: Schema.String,
  model: Schema.String,
  /** None for a mech created without instructions. */
  instructions: Schema.OptionFromNullOr(Schema.String),
  dailyCapMicros: Micros,
  revision: Schema.Int,
  status: Schema.Enum(MechStatus),
  updatedAt: Schema.DateTimeUtcFromMillis,
  updaterId: PrincipalId,
} as const;

/** The object record adds stable identity and the definition revision currently applied to its runtime. */
export const MECH_RECORD_FIELDS = {
  ...MECH_DEFINITION_FIELDS,
  id: Schema.String,
  activeRevision: Schema.Int,
  creatorId: Schema.String,
  createdAt: Schema.DateTimeUtcFromMillis,
} as const;

/** The workspace index and RPC use the same summary fields, with different encodings for time and fork point. */
export const MECH_SUMMARY_RECORD_FIELDS = Struct.pick(MECH_RECORD_FIELDS, [
  'id',
  'name',
  'model',
  'revision',
  'status',
  'creatorId',
  'createdAt',
]);

/** A dispatch as the ledger holds it; its settlement and token counts are null until it settles. */
export const DispatchRow = wireStruct({
  fields: {
    id: Schema.String,
    model: Schema.String,
    status: Schema.Enum(DispatchStatus),
    requestedMicros: Schema.Int,
    decidedAtMs: Schema.Int,
    /** Null until the dispatch settles. */
    settledMicros: Schema.NullOr(Schema.Int),
    /** Null until the dispatch settles. */
    settledAtMs: Schema.NullOr(Schema.Int),
    /** Null until the dispatch settles. */
    basis: Schema.NullOr(Schema.Enum(SettlementBasis)),
    /** Null unless the dispatch settled on the usage the upstream reported. */
    inputTokens: Schema.NullOr(Schema.Int),
    /** Null unless the dispatch settled on the usage the upstream reported. */
    outputTokens: Schema.NullOr(Schema.Int),
    /** Null unless the dispatch settled on the usage the upstream reported. */
    cacheReadTokens: Schema.NullOr(Schema.Int),
    /** Null unless the dispatch settled on the usage the upstream reported. */
    cacheWriteTokens: Schema.NullOr(Schema.Int),
  },
});

export type DispatchRow = typeof DispatchRow.Type;

/** A key as the directory stores it, its times as epoch milliseconds. */
export const KeyRow = wireStruct({
  fields: {
    id: Schema.String,
    principalId: Schema.String,
    name: Schema.String,
    purpose: Schema.Enum(KeyPurpose),
    createdAtMs: Schema.Int,
    expiresAtMs: Schema.Int,
    /** Null until the key's owner revokes it. */
    revokedAtMs: Schema.NullOr(Schema.Int),
  },
});

export type KeyRow = typeof KeyRow.Type;

/** Revoked and expired keys are included so the cache preserves their final state. */
const KeyAccess = Schema.Struct({ key: Schema.toType(KeyRow), principal: DirectoryPrincipal });

/** Workspace membership is resolved live and never carried by the key. */
export type KeyAccess = typeof KeyAccess.Type;

/** The access of the key with a token's hash, or no key of the deployment with it. */
export const KeyAccessAnswer = Schema.Union([
  Schema.TaggedStruct('Found', { access: KeyAccess }),
  Schema.TaggedStruct('Unknown', {}),
]);

export type KeyAccessAnswer = typeof KeyAccessAnswer.Type;
