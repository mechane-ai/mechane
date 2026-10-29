import { Finding } from '@mechane/protocol';
import { Schema } from 'effect';

/** The durable report receipt or the reason the observation was refused. */
export const FindingReportOutcome = Schema.TaggedUnion({
  Recorded: { finding: Finding, isChanged: Schema.Boolean },
  WatchMissing: {},
  CheckMissing: {},
  FindingsFull: {},
  InvalidWindow: {},
  EvidenceMissing: {},
});

export type FindingReportOutcome = typeof FindingReportOutcome.Type;
