import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { NormalizerRule } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';

/** The normalizers whose sites the checks hold, as an enforced rule's or a ratchet's: each one not proposed. */
export function heldNormalizers(): ReadonlyArray<NormalizerRule> {
  return REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Normalizer)
    .filter(({ status }) => status !== RuleStatus.Proposed);
}
