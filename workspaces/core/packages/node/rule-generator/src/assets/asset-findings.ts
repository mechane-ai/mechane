import type { ContractLock } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { Record } from 'effect';
import { posix } from 'node:path';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';
import { installedFiles } from './installed-files.ts';
import { installedRuleFindings } from './installed-rule-findings.ts';
import { oxlintAssetFindings } from './oxlint-asset-findings.ts';
import type { InstalledOxlintFile } from './types.ts';

/**
 * The rules that load an installed file in place, and the lock that lists each installed file. Then the files they
 * load: the TypeScript rule files of each ast-grep folder, and each oxlint file.
 */
type AssetFindingsInput = {
  readonly entries: ReadonlyArray<AssetEntry>;
  readonly lock: ContractLock;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
  readonly oxlintFiles: ReadonlyArray<InstalledOxlintFile>;
};

/**
 * Each place where a rule that loads an installed file disagrees with `.tenet.lock` or with the file (110). The lock
 * may not list the file for its contract, or an installed rule may lack an entry. An entry may lack its rule, or give
 * an oxlint rule a value its file does not.
 */
export function assetFindings({
  entries,
  lock,
  ruleFiles,
  oxlintFiles,
}: AssetFindingsInput): ReadonlyArray<RegistryFinding> {
  const isUnlisted: (entry: AssetEntry) => boolean = ({ contract, asset }) => {
    const isAssetFile: (file: string) => boolean = (file) => file === asset.path || posix.dirname(file) === asset.path;
    const installed = installedFiles({ lock, contract });
    const listed = Record.keys(installed);

    return !listed.some(isAssetFile);
  };

  const unlistedFinding: (entry: AssetEntry) => RegistryFinding = ({ contract, rule }) => ({
    path: REGISTRY,
    message: `Point the asset of ${rule.name} at a file \`.tenet.lock\` lists for ${contract.name}, such as \`asset: InstalledAsset.Oxlint\` (110)`,
  });

  return [
    ...entries.filter(isUnlisted).map(unlistedFinding),
    ...installedRuleFindings({ entries, ruleFiles }),
    ...oxlintAssetFindings({ entries, oxlintFiles }),
  ];
}
