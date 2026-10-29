import { FindingReportOutcome } from '@mechane/harness-tools';
import type { FindingReportInput } from '@mechane/harness-tools';
import { FINDINGS_PER_WATCH } from '@mechane/protocol';
import { Option } from 'effect';
import type { NowInput, TablesInput } from '../types.ts';
import { nextFinding } from './next-finding.ts';
import { notifyFinding } from './notify-finding.ts';
import { validateFindingReport } from './validate-finding-report.ts';

type DecideFindingReportInput = TablesInput & NowInput & FindingReportInput;

/** Atomically saves one valid observation, its replay receipt, and any notification intent. */
export function decideFindingReport({ store, report, taskId, now }: DecideFindingReportInput): FindingReportOutcome {
  const prior = store.findingReport({ taskId });

  if (Option.isSome(prior)) {
    return FindingReportOutcome.cases.Recorded.make(prior.value);
  }

  const watch = store.watch({ watchId: report.watchId });

  if (Option.isNone(watch)) {
    return FindingReportOutcome.cases.WatchMissing.make({});
  }

  const invalid = validateFindingReport({ store, report, now });

  if (Option.isSome(invalid)) {
    return invalid.value;
  }

  const previous = store.finding({ watchId: report.watchId, key: report.key });

  if (Option.isNone(previous) && store.findings({ watchId: report.watchId }).length >= FINDINGS_PER_WATCH) {
    return FindingReportOutcome.cases.FindingsFull.make({});
  }

  const next = nextFinding({ previous, report, now });
  const finding = notifyFinding({ store, finding: next.finding, watch: watch.value, now });
  const receipt = { finding, isChanged: next.isChanged };

  store.saveFinding({ finding });
  store.saveFindingReport({ taskId, receipt });

  return FindingReportOutcome.cases.Recorded.make(receipt);
}
