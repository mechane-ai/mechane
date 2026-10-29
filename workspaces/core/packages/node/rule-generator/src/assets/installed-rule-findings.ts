import { RuleTool } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { posix } from 'node:path';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** The rules that load an installed file in place, and the TypeScript rule files of each installed folder they load. */
type InstalledRuleFindingsInput = {
  readonly entries: ReadonlyArray<AssetEntry>;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
};

/**
 * Each TypeScript rule of a loaded folder that no entry registers (TS-05), and each entry whose folder holds no
 * TypeScript rule of its name (110).
 */
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
    message: `Name a TypeScript rule of ${path} in place of ${rule.name}, such as \`name: 'untagged-errors-typescript'\` (110)`,
  });

  return [
    ...ruleFiles.filter(isUnregistered).map(unregisteredFinding),
    ...scanned.filter(isUnshipped).map(unshippedFinding),
  ];
}
