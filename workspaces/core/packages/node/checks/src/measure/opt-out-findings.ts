import type { Finding } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';
import { MEASURE_CHECK, OPT_OUTS } from './constants.ts';
import type { Measurement } from './types.ts';

type OptOutFindingsInput = { readonly measurement: Measurement; readonly pending: ReadonlyArray<string> };

/**
 * Each place the registry's pending list differs from the run's: a listed rule that measures zero, or a rule of the
 * categories with findings that neither runs nor is listed.
 */
export function optOutFindings({ measurement, pending }: OptOutFindingsInput): ReadonlyArray<Finding> {
  const listed = CONTRACTS['code-lint-suppressions'].values.oxlint.optOuts.pending;
  const computed: ReadonlySet<string> = new Set(pending);
  const listedRules: ReadonlySet<string> = new Set(listed);

  /** Whether the run no longer computes a listed rule. */
  const isCleared: (rule: string) => boolean = (rule) => !computed.has(rule);
  /** Whether the list lacks a rule the run computes. */
  const isUnlisted: (rule: string) => boolean = (rule) => !listedRules.has(rule);

  /** What a cleared rule's finding asks for. */
  const clearedMessage: (rule: string) => string = (rule) =>
    `Take ${rule} off the pending list, such as \`pending: []\`, since it measures zero (110)`;

  /** What an unlisted rule's finding asks for. */
  const unlistedMessage: (rule: string) => string = (rule) =>
    `Add ${rule} to the pending list or sweep its ${String(measurement.counts.get(rule))} findings, such as \`pending: ['${rule}']\` (110)`;

  return [...listed.filter(isCleared).map(clearedMessage), ...pending.filter(isUnlisted).map(unlistedMessage)].map(
    (message) => ({ check: MEASURE_CHECK, location: OPT_OUTS, message }),
  );
}
