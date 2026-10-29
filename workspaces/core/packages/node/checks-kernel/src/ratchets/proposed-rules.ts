import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';

/**
 * The keys of the ast-grep, owned and normalizer rules whose status is `proposed`. Only `rules:measure` counts their
 * sites, so a rule can return to proposed without failing the check.
 */
export function proposedRules(): ReadonlySet<string> {
  return new Set(
    REGISTERED_RULES.map(({ rule }) => rule)
      .filter(
        (rule) => rule.tool === RuleTool.AstGrep || rule.tool === RuleTool.Owned || rule.tool === RuleTool.Normalizer,
      )
      .filter(({ status }) => status === RuleStatus.Proposed)
      .map(({ name }) => name),
  );
}
