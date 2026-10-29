import type { FindingReportOutcome, MechFindings } from '@mechane/harness-tools';
import type { RecordedSignal } from '@mechane/mech-ports';
import type { MechStore, MechTables } from '@mechane/mech-store';
import { DateTime } from 'effect';
import { decideFindingReport } from './decide-finding-report.ts';

type MechFindingsInput = { readonly store: MechStore; readonly recorded: RecordedSignal };

/** Connects the reporting tool to the store transaction and wakes the host after a decision. */
export function mechFindings({ store, recorded }: MechFindingsInput): MechFindings {
  const report: MechFindings['report'] = async (input) => {
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => FindingReportOutcome = (tables) =>
      decideFindingReport({ store: tables, ...input, now });

    const outcome = await store.atomic({ run: decide });

    recorded.mark();

    return outcome;
  };

  return { report };
}
