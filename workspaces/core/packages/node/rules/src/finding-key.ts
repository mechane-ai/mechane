import { RuleTool } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';

type RuleInput = { readonly rule: Rule };

/**
 * The key a rule's findings count under: a restricted rule's rule of the standard, such as `EF-02`, or any other rule's
 * own name. Each message of a restricted rule's entries ends with that rule of the standard.
 */
export function findingKey({ rule }: RuleInput): string {
  if (rule.tool === RuleTool.Restricted) {
    return rule.standard;
  }

  return rule.name;
}
