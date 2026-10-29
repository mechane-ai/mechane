import { ForkPoint, MECH_SUMMARY_RECORD_FIELDS } from '@mechane/protocol';
import { renamedWireStruct, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/**
 * The micro-dollars a UTC day has committed, what its dispatches settled and its open reservations hold: the
 * workspace's in all, and one mech's.
 */
export const CommittedRow = wireStruct({ fields: { workspaceMicros: Schema.Int, mechMicros: Schema.Int } });

export type CommittedRow = typeof CommittedRow.Type;

/** A sandbox's lease, which holds one of the workspace's machines until it expires. */
export const LeaseRow = renamedWireStruct({
  fields: { expiresAt: Schema.DateTimeUtcFromMillis },
  renames: { expiresAt: 'expires_at_ms' },
});

export type LeaseRow = typeof LeaseRow.Type;

/** A mech as the workspace's index holds it: when it was created, and the point it was forked from, if any. */
export const MechSummaryRow = renamedWireStruct({
  fields: {
    ...MECH_SUMMARY_RECORD_FIELDS,
    /** None for a mech `createMech` made, which was forked from none. */
    forkedFrom: Schema.OptionFromNullOr(Schema.fromJsonString(ForkPoint)),
  },
  renames: { createdAt: 'created_at_ms' },
});

export type MechSummaryRow = typeof MechSummaryRow.Type;

/** A page of the workspace's mechs as the store reads them, oldest first, or a cursor that names no mech of its own. */
export const MechRowPage = Schema.TaggedUnion({
  Listed: { mechs: Schema.Array(Schema.toType(MechSummaryRow)), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type MechRowPage = typeof MechRowPage.Type;
