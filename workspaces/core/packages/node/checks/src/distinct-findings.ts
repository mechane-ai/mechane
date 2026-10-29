import type { Finding } from '@mechane/checks-kernel';

type DistinctFindingsInput = { readonly findings: ReadonlyArray<Finding> };

/** Each finding once by its location and message, so a file that imports a module twice reports it once. */
export function distinctFindings({ findings }: DistinctFindingsInput): ReadonlyArray<Finding> {
  /** A finding under the key of its location and message. */
  const keyedFinding: (finding: Finding) => readonly [string, Finding] = (finding) => [
    `${finding.location}\n${finding.message}`,
    finding,
  ];

  const byKey = new Map(findings.map(keyedFinding));

  return [...byKey.values()];
}
