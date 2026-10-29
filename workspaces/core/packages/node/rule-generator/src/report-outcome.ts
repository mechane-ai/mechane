import { writeResult } from '@mechane/program';
import type { GenerateStatus } from './constants.ts';
import type { Outcome } from './types.ts';

type ReportOutcomeInput = { readonly outcome: Outcome };

/** Writes a run's results to standard output and answers the status its outcome names. */
export function reportOutcome({ outcome }: ReportOutcomeInput): GenerateStatus {
  for (const line of outcome.results) {
    writeResult({ line });
  }

  return outcome.status;
}
