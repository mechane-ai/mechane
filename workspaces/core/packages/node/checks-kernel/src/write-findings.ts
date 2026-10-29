import { writeResult } from '@mechane/program';
import type { Finding } from './types.ts';

/** The findings a run ends with. */
type WriteFindingsInput = { readonly findings: ReadonlyArray<Finding> };

/** Writes each finding to standard output, the program's result, one per line. */
export function writeFindings({ findings }: WriteFindingsInput): void {
  for (const finding of findings) {
    writeResult({ line: `${finding.location}: ${finding.check}: ${finding.message}` });
  }
}
