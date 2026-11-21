import { RuleTool } from '@mechane/rule-shapes';
import { CONTRACTS, REGISTERED_RULES } from '@mechane/rules';

/** The name a suppression of jscpd counts under. */
const JSCPD_RULE = 'jscpd';

/** What separates an oxlint plugin's name from its rule's, as in `typescript/no-explicit-any`. */
const PLUGIN_SEPARATOR = '/';

/** The name a suppression gives a rule, with or without its plugin. */
type SuppressionBudgetInput = { readonly name: string };

type RegisteredRule = (typeof REGISTERED_RULES)[number]['rule'];

type RuleBudgetInput = { readonly rule: RegisteredRule; readonly name: string };

function ruleBudget({ rule, name }: RuleBudgetInput): ReadonlyArray<number> {
  switch (rule.tool) {
    case RuleTool.Oxlint:
    case RuleTool.AstGrep: {
      const isNamed = rule.name === name || rule.name.slice(rule.name.lastIndexOf(PLUGIN_SEPARATOR) + 1) === name;

      if (isNamed) {
        return [rule.maxSuppressions];
      }

      return [];
    }
    case RuleTool.Compiler:
    case RuleTool.Cruiser:
    case RuleTool.Manifest:
    case RuleTool.Normalizer:
    case RuleTool.Owned:
    case RuleTool.Restricted:
      return [];
  }
}

/**
 * A rule's budget: jscpd's contract value for jscpd, else the most any entry allows. An entry counts by the rule's name
 * with or without its plugin, and a rule without one, such as an owned rule, allows none.
 */
export function suppressionBudget({ name }: SuppressionBudgetInput): number {
  if (name === JSCPD_RULE) {
    return CONTRACTS['code-duplicated-blocks'].values.jscpdSuppressions;
  }

  const budgets = REGISTERED_RULES.flatMap(({ rule }) => ruleBudget({ rule, name }));

  return Math.max(0, ...budgets);
}
