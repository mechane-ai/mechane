import { FINDING_RECORD_FIELDS, FindingState } from '@mechane/protocol';
import { RecordText, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** The current finding stored with millisecond times and notification deduplication state. */
export const FindingRow = renamedWireStruct({
  fields: {
    ...FINDING_RECORD_FIELDS,
    evidence: Schema.fromJsonString(FINDING_RECORD_FIELDS.evidence),
    windowStart: Schema.DateTimeUtcFromMillis,
    windowEnd: Schema.DateTimeUtcFromMillis,
    firstObservedAt: Schema.DateTimeUtcFromMillis,
    observedAt: Schema.DateTimeUtcFromMillis,
    changedAt: Schema.DateTimeUtcFromMillis,
    /** Absent until a notification intent has been queued for this identity. */
    notifiedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    /** Absent until a notification intent records its condition fingerprint. */
    notifiedFingerprint: Schema.OptionFromNullOr(RecordText),
    /** Absent until a notification intent records its finding state. */
    notifiedState: Schema.OptionFromNullOr(Schema.Enum(FindingState)),
  },
  renames: {
    windowStart: 'window_start_ms',
    windowEnd: 'window_end_ms',
    firstObservedAt: 'first_observed_at_ms',
    observedAt: 'observed_at_ms',
    changedAt: 'changed_at_ms',
    notifiedAt: 'notified_at_ms',
  },
});

export type FindingRow = typeof FindingRow.Type;
