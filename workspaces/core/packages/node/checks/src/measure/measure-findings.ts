import type { Finding } from '@mechane/checks-kernel';
import { RuleFix, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { OxlintRule, RegisteredRule } from '@mechane/rule-shapes';
import { REGISTRY } from '../constants.ts';
import { MEASURE_CHECK } from './constants.ts';
import { countedRules } from './counted-rules.ts';
import { optOutFindings } from './opt-out-findings.ts';
import type { CountedRule, MeasureFindingsInput, Measurement } from './types.ts';

type FixFindingsInput = { readonly rules: ReadonlyArray<RegisteredRule>; readonly measurement: Measurement };

/**
 * Each place where the registry differs from the measuring run. A rule's findings contradict its status, an oxlint
 * rule's fix differs from the one oxlint reports, or the opt-out list differs from the one the run computes.
 */
export function measureFindings({ rules, measurement, pending }: MeasureFindingsInput): ReadonlyArray<Finding> {
  /**
   * What a rule's findings say of its status: a proposed rule at zero is enforced, an enforced one with findings is
   * not.
   */
  const statusMessages: (counted: CountedRule) => ReadonlyArray<string> = ({
    contract,
    key,
    standard,
    status,
    count,
  }) => {
    if (status === RuleStatus.Proposed && count === 0) {
      return [
        `Set the status of ${key} in ${contract} to enforced, such as \`status: RuleStatus.Enforced\`, since it measures zero (${standard})`,
      ];
    }

    if (status === RuleStatus.Enforced && count > 0) {
      return [
        `Sweep the ${String(count)} findings of ${key} or make it a ratchet in ${contract}, such as \`status: RuleStatus.Ratchet\` (${standard})`,
      ];
    }

    return [];
  };

  return [
    ...countedRules({ rules, measurement })
      .flatMap(statusMessages)
      .map((message) => ({ check: MEASURE_CHECK, location: REGISTRY, message })),
    ...fixFindings({ rules, measurement }),
    ...optOutFindings({ measurement, pending }),
  ];
}

/** Each oxlint rule whose registry entry says it has an autofix where oxlint reports none, or the reverse (TS-07). */
function fixFindings({ rules, measurement }: FixFindingsInput): ReadonlyArray<Finding> {
  /** Whether the rule's entry gives a fix other than the one oxlint reports. */
  const isMismatched: (rule: OxlintRule) => boolean = ({ name, fix }) =>
    measurement.fixable.has(name) !== (fix === RuleFix.Oxlint);

  /** A mismatched rule's finding: which fix its entry should give, with an example. */
  const fixFinding: (rule: OxlintRule) => Finding = ({ name, fix }) => {
    if (fix === RuleFix.Oxlint) {
      return {
        check: MEASURE_CHECK,
        location: REGISTRY,
        message: `Set the fix of ${name} by hand, such as \`fix: RuleFix.Manual\`, since oxlint reports no safe fix (TS-07)`,
      };
    }

    return {
      check: MEASURE_CHECK,
      location: REGISTRY,
      message: `Set the fix of ${name} to oxlint's, such as \`fix: RuleFix.Oxlint\`, since \`oxlint --fix\` applies it (TS-07)`,
    };
  };

  return rules
    .map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Oxlint)
    .filter(isMismatched)
    .map(fixFinding);
}
