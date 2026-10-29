import type { FindingRow } from '@mechane/mech-store';
import { FindingChange, FindingState } from '@mechane/protocol';
import type { FindingReport } from '@mechane/protocol';
import { FindingId } from '@mechane/records';
import { Option } from 'effect';
import type { DateTime } from 'effect';

type NextFindingInput = {
  /** Absent until this watch first observes the finding identity. */
  readonly previous: Option.Option<FindingRow>;
  readonly report: FindingReport;
  readonly now: DateTime.Utc;
};

type NextFinding = { readonly finding: FindingRow; readonly isChanged: boolean };

type FindingChangeInput = { readonly state: FindingState; readonly isFirstObservation: boolean };

/** Refreshes evidence while preserving identity and advancing the revision only for material changes. */
export function nextFinding({ previous, report, now }: NextFindingInput): NextFinding {
  if (Option.isNone(previous)) {
    const change = findingChange({ state: report.state, isFirstObservation: true });

    return {
      finding: {
        ...report,
        id: FindingId.make(crypto.randomUUID()),
        change,
        revision: 1,
        firstObservedAt: now,
        observedAt: now,
        changedAt: now,
        notifiedAt: Option.none(),
        notifiedFingerprint: Option.none(),
        notifiedState: Option.none(),
      },
      isChanged: true,
    };
  }

  const current = previous.value;
  const isChanged = current.state !== report.state || current.fingerprint !== report.fingerprint;

  if (!isChanged) {
    return { finding: { ...current, ...report, observedAt: now }, isChanged: false };
  }

  const change = findingChange({ state: report.state, isFirstObservation: false });

  return {
    finding: { ...current, ...report, change, revision: current.revision + 1, observedAt: now, changedAt: now },
    isChanged: true,
  };
}

function findingChange({ state, isFirstObservation }: FindingChangeInput): FindingChange {
  if (state === FindingState.Unknown) {
    return FindingChange.Unknown;
  }

  if (isFirstObservation) {
    return FindingChange.Appeared;
  }

  if (state === FindingState.Recovered) {
    return FindingChange.Recovered;
  }

  return FindingChange.Changed;
}
