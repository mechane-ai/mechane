import { RuleTool } from '@mechane/rule-shapes';
import type { AstGrepRule, OxlintRule } from '@mechane/rule-shapes';
import { CONTRACTS, REGISTERED_RULES } from '@mechane/rules';
import { REGISTRY } from '../constants.ts';
import { astGrepMessages } from '../rule-files/ast-grep-messages.ts';
import { ruleFileFindings } from '../rule-files/rule-file-findings.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';
import { oxlintMessages } from './oxlint-messages.ts';

/** Every ast-grep rule file. */
type RuleFindingsInput = { readonly ruleFiles: ReadonlyArray<RuleFile> };

/**
 * Each place where the registry's rules break the standard. An ast-grep rule lacks its file, entry or examples (TS-05),
 * or its fix differs from its file's (TS-07); a budget exceeds the most a rule may allow (AS-02). The oxlint rules' own
 * findings follow.
 */
export function ruleFindings({ ruleFiles }: RuleFindingsInput): ReadonlyArray<RegistryFinding> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule);
  const astGrep = rules.filter((rule) => rule.tool === RuleTool.AstGrep);
  const oxlint = rules.filter((rule) => rule.tool === RuleTool.Oxlint);
  const { maxRuleSuppressions } = CONTRACTS['code-lint-suppressions'].values;

  const budgetMessage: (rule: AstGrepRule | OxlintRule) => string = ({ name }) =>
    `Reword ${name} to need fewer suppressions, such as \`maxSuppressions: ${String(maxRuleSuppressions)}\` (AS-02)`;

  const messages = [
    ...astGrepMessages({ astGrep, ruleFiles }),
    ...[...astGrep, ...oxlint]
      .filter(({ maxSuppressions }) => maxSuppressions > maxRuleSuppressions)
      .map(budgetMessage),
    ...oxlintMessages({ oxlint }),
  ];

  return [...ruleFileFindings({ astGrep, ruleFiles }), ...messages.map((message) => ({ path: REGISTRY, message }))];
}
