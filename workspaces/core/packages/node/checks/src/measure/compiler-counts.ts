import { RuleStatus } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';
import type { Measurement } from './types.ts';

type CompilerCountsInput = { readonly rule: Rule; readonly measurement: Measurement };

/** A compiler option's findings: the compiler's errors while it is proposed, since a running option has none. */
export function compilerCounts({ rule, measurement }: CompilerCountsInput): ReadonlyArray<number> {
  if (rule.status !== RuleStatus.Proposed) {
    return [];
  }

  return [measurement.compilerErrors];
}
