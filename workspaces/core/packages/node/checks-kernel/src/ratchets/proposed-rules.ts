import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';

type RegisteredRule = (typeof REGISTERED_RULES)[number]['rule'];
type RuleInput = { readonly rule: RegisteredRule };

function proposedRuleName({ rule }: RuleInput): ReadonlyArray<string> {
  switch (rule.tool) {
    case RuleTool.AstGrep:
    case RuleTool.Owned:
    case RuleTool.Normalizer:
      if (rule.status === RuleStatus.Proposed) {
        return [rule.name];
      }

      return [];
    case RuleTool.Compiler:
    case RuleTool.Cruiser:
    case RuleTool.Manifest:
    case RuleTool.Oxlint:
    case RuleTool.Restricted:
      return [];
  }
}

/**
 * The keys of the ast-grep, owned and normalizer rules whose status is `proposed`. Only `rules:measure` counts their
 * sites, so a rule can return to proposed without failing the check.
 */
export function proposedRules(): ReadonlySet<string> {
  return new Set(REGISTERED_RULES.flatMap(({ rule }) => proposedRuleName({ rule })));
}
