import { RuleTool } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { Record } from 'effect';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding } from '../types.ts';
import type { InstalledOxlintFile } from './types.ts';

/** The rules that load an installed file in place, and each installed oxlint file they load. */
type OxlintAssetFindingsInput = {
  readonly entries: ReadonlyArray<AssetEntry>;
  readonly oxlintFiles: ReadonlyArray<InstalledOxlintFile>;
};

/** One installed oxlint file, and the rules that load it. */
type FileFindingsInput = { readonly file: InstalledOxlintFile; readonly entries: ReadonlyArray<AssetEntry> };

/**
 * Each rule an installed oxlint file configures that no entry of that file registers with the value the file gives it,
 * and each entry its file does not configure (110). An entry's value is compared as JSON writes it.
 */
export function oxlintAssetFindings({
  entries,
  oxlintFiles,
}: OxlintAssetFindingsInput): ReadonlyArray<RegistryFinding> {
  const fileFindings: (file: InstalledOxlintFile) => ReadonlyArray<RegistryFinding> = (file) => {
    const isFileEntry: (entry: AssetEntry) => boolean = ({ rule, path }) =>
      rule.tool === RuleTool.Oxlint && path === file.path;

    const fileEntries = entries.filter(isFileEntry);

    return oxlintFileFindings({ file, entries: fileEntries });
  };

  return oxlintFiles.flatMap(fileFindings);
}

/** The findings of one installed oxlint file against the entries that load it. */
function oxlintFileFindings({ file, entries }: FileFindingsInput): ReadonlyArray<RegistryFinding> {
  const ruleFinding: (configured: readonly [string, unknown]) => ReadonlyArray<RegistryFinding> = ([name, value]) => {
    const written = JSON.stringify(value);

    const isRegistered: (entry: AssetEntry) => boolean = ({ rule }) =>
      rule.tool === RuleTool.Oxlint && rule.name === name && JSON.stringify(rule.value) === written;

    if (entries.some(isRegistered)) {
      return [];
    }

    return [
      {
        path: file.path,
        message: `Register ${name} with the value this file gives it, such as \`value: ${written}\` (110)`,
      },
    ];
  };

  const isUnconfigured: (entry: AssetEntry) => boolean = ({ rule }) => !Record.has(file.rules, rule.name);

  const unconfiguredFinding: (entry: AssetEntry) => RegistryFinding = ({ rule }) => ({
    path: REGISTRY,
    message: `Name a rule ${file.path} configures in place of ${rule.name}, such as \`name: 'no-throw-literal'\` (110)`,
  });

  const configured = Record.toEntries(file.rules);

  return [...configured.flatMap(ruleFinding), ...entries.filter(isUnconfigured).map(unconfiguredFinding)];
}
