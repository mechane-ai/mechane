import type { Finding } from '@mechane/checks-kernel';
import type { RunFinding } from './types.ts';

type RunFindingsInput = { readonly findings: ReadonlyArray<Finding> };

/** A check's findings as a run reports them, each by the rule it counts under. */
export function runFindings({ findings }: RunFindingsInput): ReadonlyArray<RunFinding> {
  return findings.map(({ check, message }) => ({ rule: check, message }));
}
