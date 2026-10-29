import { RuleStatus, RuleTool, Severity } from '@mechane/rule-shapes';
import { CONTRACTS, oxlintSettings, REGISTERED_RULES } from '@mechane/rules';
import type { OxlintSettings } from '@mechane/rules';
import { Record } from 'effect';

/**
 * oxlint's settings for the enforced rules, as `.oxlintrc.json` holds them but with each ratchet's rule off, so
 * oxlint's fixes leave the sites a baseline holds for that rule's sweep.
 */
export function enforcedConfiguration(): OxlintSettings {
  const { optOuts } = CONTRACTS['code-lint-suppressions'].values.oxlint;
  const rules = REGISTERED_RULES.map(({ rule }) => rule);
  const settings = oxlintSettings({ rules: rules.filter(({ status }) => status === RuleStatus.Enforced), optOuts });

  const held = rules
    .filter((rule) => rule.tool === RuleTool.Oxlint)
    .filter(({ status }) => status === RuleStatus.Ratchet)
    .map(({ name }) => [name, Severity.Off] as const);

  return { ...settings, rules: { ...settings.rules, ...Record.fromEntries(held) } };
}
