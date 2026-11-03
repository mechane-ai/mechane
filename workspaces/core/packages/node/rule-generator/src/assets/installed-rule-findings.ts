import { RuleTool } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { posix } from 'node:path';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** The entries and the TypeScript or selected JSX assets loaded from their installed folders. */
type InstalledRuleFindingsInput = {
  readonly entries: ReadonlyArray<AssetEntry>;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
};

/** Each loaded TypeScript rule without an entry (TS-05), and each entry without its supported asset (110). */
export function installedRuleFindings({
  entries,
  ruleFiles,
}: InstalledRuleFindingsInput): ReadonlyArray<RegistryFinding> {
  const scanned = entries.filter(({ rule }) => rule.tool === RuleTool.AstGrep);

  const isUnregistered: (ruleFile: RuleFile) => boolean = ({ path, id }) => {
    const isFileEntry: (entry: AssetEntry) => boolean = (entry) =>
      entry.rule.name === id && entry.path === posix.dirname(path);

    return !scanned.some(isFileEntry);
  };

  const unregisteredFinding: (ruleFile: RuleFile) => RegistryFinding = ({ path, id }) => ({
    path,
    message: `Register ${id} with examples beside its contract's rules, such as \`name: '${id}'\` (TS-05)`,
  });

  const isUnshipped: (entry: AssetEntry) => boolean = (entry) => {
    const isEntryFile: (ruleFile: RuleFile) => boolean = ({ path, id }) =>
      id === entry.rule.name && posix.dirname(path) === entry.path;

    return !ruleFiles.some(isEntryFile);
  };

  const unshippedFinding: (entry: AssetEntry) => RegistryFinding = ({ rule, path }) => ({
    path: REGISTRY,
    message: `Name a supported rule of ${path} in place of ${rule.name}, such as \`name: 'variant-style-comparisons-tsx'\` (110)`,
  });

  return [
    ...ruleFiles.filter(isUnregistered).map(unregisteredFinding),
    ...scanned.filter(isUnshipped).map(unshippedFinding),
  ];
}
