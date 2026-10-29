import { FindingReportOutcome } from '@mechane/harness-tools';
import type { FindingReportInput } from '@mechane/harness-tools';
import { FindingState } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import type { NowInput, TablesInput } from '../types.ts';

type ValidateFindingReportInput = TablesInput & NowInput & Pick<FindingReportInput, 'report'>;

/** Refuses reports outside a live check or without a valid evidence window and supporting links. */
export function validateFindingReport({
  store,
  report,
  now,
}: ValidateFindingReportInput): Option.Option<FindingReportOutcome> {
  if (store.runningWatchCheckCount({ watchId: report.watchId, now }) === 0) {
    const outcome = FindingReportOutcome.cases.CheckMissing.make({});

    return Option.some(outcome);
  }

  if (DateTime.isGreaterThan(report.windowStart, report.windowEnd) || DateTime.isGreaterThan(report.windowEnd, now)) {
    const outcome = FindingReportOutcome.cases.InvalidWindow.make({});

    return Option.some(outcome);
  }

  if (report.state !== FindingState.Unknown && report.evidence.length === 0) {
    const outcome = FindingReportOutcome.cases.EvidenceMissing.make({});

    return Option.some(outcome);
  }

  return Option.none();
}
