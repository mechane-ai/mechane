import { FileRole, RuleTool, Severity } from '@mechane/rule-shapes';
import type { OxlintRule, RestrictedRule, Rule } from '@mechane/rule-shapes';
import { Option, Record } from 'effect';
import { CONTRACTS } from '../contracts.ts';
import { FILE_ROLES } from '../file-roles.ts';
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
  const interaction = CONTRACTS['ui-react-interaction-ownership'];
  const interactionRules = interaction.rules.map(({ name, value }) => [name, value] as const);
  const naming = CONTRACTS['code-spelled-out-names'].values;
  const browserIdentifierLength = { ...naming.identifierLength, properties: naming.browserProperties };

  const browser = {
    files: FILE_ROLES[FileRole.Browser],
    plugins: [...oxlint.plugins, ...interaction.values.plugins],
    rules: { ...Record.fromEntries(interactionRules), 'id-length': [Severity.Error, browserIdentifierLength] },
  };

  const charts = {
    files: naming.chartFiles,
    rules: {
      'id-length': [
        Severity.Error,
        { ...browserIdentifierLength, exceptions: [...naming.identifierLength.exceptions, ...naming.chartCoordinates] },
      ],
    },
  };

  const scoped = configured.flatMap((rule) => {
    if (Option.isNone(rule.files)) {
      return [];
    }

    return [{ files: rule.files.value, rules: { [rule.name]: rule.value } }];
  });

  const global = configured.filter((rule) => Option.isNone(rule.files));

  return {
    plugins: oxlint.plugins,
    categories: Record.fromEntries(oxlint.categories.map((category) => [category, Severity.Error])),
    options: oxlint.options,
    ignorePatterns: oxlint.ignorePatterns,
    rules: oxlintRules({ configured: global, restricted, optOuts }),
    overrides: [
      browser,
      charts,
      ...scoped,
      ...Record.values(FileRole).flatMap((role) => roleOverride({ role, configured, restricted })),
    ],
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
