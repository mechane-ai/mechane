import { FileRole, RuleTool, Severity } from '@mechane/rule-shapes';
import type { OxlintRule, RestrictedRule, Rule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { CONTRACTS } from '../contracts.ts';
import { RestrictedKey } from './constants.ts';
import { restrictedLists } from './restricted-lists.ts';
import { roleOverride } from './role-override.ts';
import type { OptOuts, OxlintSettings } from './types.ts';

/** The rules oxlint's settings run, and the opt-outs they turn off. */
type OxlintSettingsInput = { readonly rules: ReadonlyArray<Rule>; readonly optOuts: OptOuts };

type OxlintRulesInput = {
  readonly configured: ReadonlyArray<OxlintRule>;
  readonly restricted: ReadonlyArray<RestrictedRule>;
  readonly optOuts: OptOuts;
};

/**
 * oxlint's settings that run `rules`: the plugins and six categories, then each oxlint rule with its value in the
 * contracts' order. The restricted rules' banned members and the opt-outs, off, follow, with one override for each file
 * role that a rule treats apart.
 */
export function oxlintSettings({ rules, optOuts }: OxlintSettingsInput): OxlintSettings {
  const { oxlint } = CONTRACTS['code-lint-suppressions'].values;
  const configured = rules.filter((rule) => rule.tool === RuleTool.Oxlint);
  const restricted = rules.filter((rule) => rule.tool === RuleTool.Restricted);

  return {
    plugins: oxlint.plugins,
    categories: Record.fromEntries(oxlint.categories.map((category) => [category, Severity.Error])),
    options: oxlint.options,
    ignorePatterns: oxlint.ignorePatterns,
    rules: oxlintRules({ configured, restricted, optOuts }),
    overrides: Record.values(FileRole).flatMap((role) => roleOverride({ role, configured, restricted })),
  };
}

/** The rules: each configured one, the restricted members, then the opt-out list. */
function oxlintRules({ configured, restricted, optOuts }: OxlintRulesInput): Readonly<Record<string, unknown>> {
  return {
    ...Record.fromEntries(configured.map(({ name, value }) => [name, value])),
    ...restrictedLists({ restricted, keys: [RestrictedKey.Imports, RestrictedKey.Properties] }),
    ...Record.fromEntries(optOuts.pending.map((rule) => [rule, Severity.Off])),
    ...Record.map(optOuts.decided, () => Severity.Off),
  };
}
