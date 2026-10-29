import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { RegisteredRule } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';

/**
 * Every rule of the registry as the measuring run counts it. A proposed oxlint rule replaces each running entry of its
 * name, since the run sets the rule to the standard's value.
 */
export function measuredRules(): ReadonlyArray<RegisteredRule> {
  const proposed: ReadonlySet<string> = new Set(
    REGISTERED_RULES.map(({ rule }) => rule)
      .filter((rule) => rule.tool === RuleTool.Oxlint)
      .filter(({ status }) => status === RuleStatus.Proposed)
      .map(({ name }) => name),
  );

  /** Whether the run counts the entry: a rule of another tool, a proposed one, or one no proposed entry replaces. */
  const isMeasured: (registered: RegisteredRule) => boolean = ({ rule }) =>
    rule.tool !== RuleTool.Oxlint || rule.status === RuleStatus.Proposed || !proposed.has(rule.name);

  return REGISTERED_RULES.filter(isMeasured);
}
