import { RuleStatus, RuleTool, Severity } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';
import { configurationText } from '../configurations/configuration-text.ts';
import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import { REGISTERED_RULES } from '../registered-rules.ts';
import type { GeneratedFile, WorkspaceMember } from '../types.ts';
import { manifestEntries } from './manifest-entries.ts';
import type { CruiserEntry } from './types.ts';

/** The doc comment above `.dependency-cruiser.cjs`'s export, which says what the owned checks add to its rules. */
const CRUISER_SUMMARY =
  'Module boundaries that dependency-cruiser resolves import by import; the owned checks add entry points and packages.';

type CruiserConfigurationInput = { readonly members: ReadonlyArray<WorkspaceMember> };

type RuleEntriesInput = { readonly rule: Rule; readonly members: ReadonlyArray<WorkspaceMember> };

/**
 * `.dependency-cruiser.cjs`: each running dependency-cruiser rule in the order of the contracts, each family the
 * manifest generates expanded in its place, and the options.
 */
export function cruiserConfiguration({ members }: CruiserConfigurationInput): GeneratedFile {
  const { cruiserOptions, cruiserNotes } = CONTRACTS['code-typescript-module-boundaries'].values;

  const forbidden = REGISTERED_RULES.map(({ rule }) => rule)
    .filter(({ status }) => status !== RuleStatus.Proposed)
    .flatMap((rule) => ruleEntries({ rule, members }));

  const text = configurationText({
    value: { forbidden, options: cruiserOptions },
    notes: cruiserNotes,
    expanded: [],
    syntax: Syntax.JavaScript,
  });

  return { path: ConfigurationPath.Cruiser, text: `/** ${CRUISER_SUMMARY} */\nmodule.exports = ${text};\n` };
}

/** A rule's entries in the configuration: a dependency-cruiser rule's own, a family's expansion, or none. */
function ruleEntries({ rule, members }: RuleEntriesInput): ReadonlyArray<CruiserEntry> {
  switch (rule.tool) {
    case RuleTool.Cruiser:
      return [{ name: rule.name, comment: rule.comment, severity: Severity.Error, from: rule.from, to: rule.to }];
    case RuleTool.Manifest:
      return manifestEntries({ rule, members });
    case RuleTool.Oxlint:
    case RuleTool.Restricted:
    case RuleTool.AstGrep:
    case RuleTool.Owned:
    case RuleTool.Compiler:
    case RuleTool.Normalizer:
      return [];
  }
}
