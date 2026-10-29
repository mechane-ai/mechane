import { RuleTool } from '@mechane/rule-shapes';
import type { RegisteredRule, Rule } from '@mechane/rule-shapes';
import { findingKey } from '@mechane/rules';
import { Option } from 'effect';
import { compilerCounts } from './compiler-counts.ts';
import type { CountedRule, Measurement } from './types.ts';

type CountedRulesInput = { readonly rules: ReadonlyArray<RegisteredRule>; readonly measurement: Measurement };

type RuleCountsInput = { readonly rule: Rule; readonly measurement: Measurement };

/**
 * Each registry rule the measuring run counts, once by the key its findings count under. It counts every oxlint,
 * restricted and owned rule, and the proposed compiler options, which share the compiler's errors.
 */
export function countedRules({ rules, measurement }: CountedRulesInput): ReadonlyArray<CountedRule> {
  /** A registered rule's counted entries: none, or one with its findings. */
  const countedEntries: (registered: RegisteredRule) => ReadonlyArray<CountedRule> = ({ contract, rule }) => {
    const key = findingKey({ rule });
    const { standard, status, phase } = rule;

    return ruleCounts({ rule, measurement }).map((count) => ({ contract, key, standard, status, phase, count }));
  };

  const counted = rules.flatMap(countedEntries);

  return [...new Map(counted.map((entry) => [entry.key, entry])).values()];
}

/**
 * A rule's findings, which a rule the run cannot count, a dependency-cruiser rule or family or a running option, has
 * none of. A normalizer's findings are the sites its dry run would rewrite.
 */
function ruleCounts({ rule, measurement }: RuleCountsInput): ReadonlyArray<number> {
  switch (rule.tool) {
    case RuleTool.Cruiser:
    case RuleTool.Manifest:
      return [];
    case RuleTool.Compiler:
      return compilerCounts({ rule, measurement });
    case RuleTool.Oxlint:
    case RuleTool.Restricted:
    case RuleTool.Owned:
    case RuleTool.Normalizer:
    case RuleTool.AstGrep:
      return [Option.getOrElse(Option.fromNullishOr(measurement.counts.get(findingKey({ rule }))), () => 0)];
  }
}
