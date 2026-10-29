import { CHECKS_PROGRAM, CheckStatus, writeFindings } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import { writeDiagnostic } from '@mechane/program';

type ReportFindingsInput = { readonly findings: ReadonlyArray<Finding> };

/** Writes the findings a run ended with, and a count of them when there are any; answers the status they call for. */
export function reportFindings({ findings }: ReportFindingsInput): CheckStatus {
  writeFindings({ findings });

  if (findings.length === 0) {
    return CheckStatus.Clean;
  }

  writeDiagnostic({ program: CHECKS_PROGRAM, line: `${findings.length} findings` });

  return CheckStatus.Findings;
}
