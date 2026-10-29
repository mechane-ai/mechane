import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { OxlintRule, Rule } from '@mechane/rule-shapes';
import { Array, Option, Record } from 'effect';
import { assetEntries } from '../assets/asset-entries.ts';
import { loadedAsset } from '../assets/loaded-asset.ts';
import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import { oxlintSettings } from '../oxlint/oxlint-settings.ts';
import type { OptOuts } from '../oxlint/types.ts';
import { REGISTERED_RULES } from '../registered-rules.ts';
import type { AssetEntry, ContractText, GeneratedFile } from '../types.ts';
import { configurationText } from './configuration-text.ts';
import type { ConfigurationNote } from './types.ts';

/** The comments of `.oxlintrc.json`: why the categories run whole, and the headings of the opt-out list. */
const OxlintNote = {
  Categories: [
    'Every rule of the six categories runs unless the opt-out list that ends `rules` turns it off;',
    '`mise -C workspaces/core run rules:measure` computes that list and finds each standard rule that measures zero.',
  ],
  Pending:
    'Off while the tree has findings; `mise -C workspaces/core run rules:measure` lists them, and a sweep turns one on.',
  Decided: 'Off whatever they measure, each for its reason.',
} as const;

type OxlintConfigurationInput = { readonly contracts: ReadonlyArray<ContractText> };

type OxlintNotesInput = { readonly configured: ReadonlyArray<OxlintRule>; readonly optOuts: OptOuts };

/**
 * `.oxlintrc.json`: each installed file a running rule loads, extended in place, and oxlint's settings for every other
 * rule that runs, the opt-out list off. A comment states each rule's note and the list's headings and reasons.
 */
export function oxlintConfiguration({ contracts }: OxlintConfigurationInput): GeneratedFile {
  const { optOuts } = CONTRACTS['code-lint-suppressions'].values.oxlint;
  const isRunning: (rule: Rule) => boolean = ({ status }) => status !== RuleStatus.Proposed;

  const isOwn: (rule: Rule) => boolean = (rule) => {
    const asset = loadedAsset({ rule });

    return Option.isNone(asset);
  };

  const running = REGISTERED_RULES.map(({ rule }) => rule).filter(isRunning);
  const own = running.filter(isOwn);
  const configured = own.filter((rule) => rule.tool === RuleTool.Oxlint);
  const isExtended: (entry: AssetEntry) => boolean = ({ rule }) => rule.tool === RuleTool.Oxlint && isRunning(rule);

  const extended = assetEntries({ contracts })
    .filter(isExtended)
    .map(({ path }) => path);

  const value = {
    $schema: './node_modules/oxlint/configuration_schema.json',
    extends: Array.dedupe(extended),
    ...oxlintSettings({ rules: own, optOuts }),
  };

  return {
    path: ConfigurationPath.Oxlint,
    text: configurationText({ value, notes: oxlintNotes({ configured, optOuts }), expanded: [], syntax: Syntax.Json }),
  };
}

/** The comments: why the categories run whole, each rule's note, and the opt-out list's headings and reasons. */
function oxlintNotes({ configured, optOuts }: OxlintNotesInput): ReadonlyArray<ConfigurationNote> {
  const ruleNotes: (rule: OxlintRule) => ReadonlyArray<ConfigurationNote> = ({ name, note }) =>
    Option.toArray(note).map((line) => ({ path: ['rules', name], lines: [line] }));

  const noted = configured.flatMap(ruleNotes);

  const pending = Option.toArray(Array.head(optOuts.pending)).map((rule) => ({
    path: ['rules', rule],
    lines: [OxlintNote.Pending],
  }));

  const decidedNotes: (
    reasons: Array.NonEmptyReadonlyArray<readonly [string, string]>,
  ) => ReadonlyArray<ConfigurationNote> = ([[rule, reason], ...rest]) => [
    { path: ['rules', rule], lines: [OxlintNote.Decided, reason] },
    ...rest.map(([later, laterReason]) => ({ path: ['rules', later], lines: [laterReason] })),
  ];

  const decided = Array.match(Record.toEntries(optOuts.decided), { onEmpty: () => [], onNonEmpty: decidedNotes });

  return [{ path: ['categories'], lines: OxlintNote.Categories }, ...noted, ...pending, ...decided];
}
