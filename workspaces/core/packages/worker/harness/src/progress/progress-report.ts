import { Option } from 'effect';
import { requestedChanges } from './requested-changes.ts';
import type { ItemProgressReport, ReadSubmission, RequestedSubmission } from './types.ts';

/** What pi holds of the inbox items and of the briefs of drones whose conversation exists. */
type ProgressReportInput = {
  readonly items: ReadonlyArray<ReadSubmission>;
  readonly briefs: ReadonlyArray<ReadSubmission>;
};

/** The progress of every admitted submission, and the requests pi never admitted. */
export function progressReport({ items, briefs }: ProgressReportInput): ItemProgressReport {
  const reads = [...items, ...briefs];
  const answers = new Map(reads.flatMap((read) => read.answers).map((entry) => [entry.id, entry] as const));

  const admitted: (read: ReadSubmission) => ReadonlyArray<RequestedSubmission> = ({ requestId, record }) =>
    Option.toArray(Option.map(record, (found) => ({ requestId, record: found })));

  const requested = reads.flatMap(admitted);

  return {
    ...requestedChanges({ requested, answers }),
    missing: items.filter(({ record }) => Option.isNone(record)).map(({ requestId }) => requestId),
    unbriefed: briefs.filter(({ record }) => Option.isNone(record)).map(({ requestId }) => requestId),
  };
}
