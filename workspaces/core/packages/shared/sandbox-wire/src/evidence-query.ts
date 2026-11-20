import { EvidenceArtifactId, RecordName, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Only ready captures may serve media; pending and failed captures retain their receipts. */
export const EvidenceStatus = { Pending: 'pending', Ready: 'ready', Failed: 'failed' } as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

/** The cursor advances through immutable receipts and may restrict results to one turn. */
export const EvidenceQuery = wireStruct({
  fields: {
    /** Absent on the first page. */
    after: Schema.OptionFromOptionalKey(EvidenceArtifactId),
    /** Absent when listing captures from every turn. */
    turnId: Schema.OptionFromOptionalKey(TurnId),
    search: Schema.optionalKey(RecordName),
    filter: Schema.optionalKey(Schema.Enum(EvidenceStatus)),
  },
});

export type EvidenceQuery = typeof EvidenceQuery.Type;
