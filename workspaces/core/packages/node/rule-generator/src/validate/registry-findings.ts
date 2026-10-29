import { assetEntries } from '@mechane/rules';
import type { ContractText, WordLists } from '@mechane/rules';
import { Effect } from 'effect';
import { assetFindings } from '../assets/asset-findings.ts';
import { derivedRuleFindings } from '../assets/derived-rule-findings.ts';
import { readInstalledRuleFiles } from '../assets/read-installed-rule-files.ts';
import { readLock } from '../assets/read-lock.ts';
import { readOxlintAssets } from '../assets/read-oxlint-assets.ts';
import type { GenerateFailed } from '../errors.ts';
import { workspaceFiles } from '../files/workspace-files.ts';
import { readRuleFiles } from '../rule-files/read-rule-files.ts';
import type { RegistryFinding } from '../types.ts';
import { messageFindings } from './message-findings.ts';
import { patternFindings } from './pattern-findings.ts';
import { ruleFindings } from './rule-findings.ts';
import { suppressionFindings } from './suppression-findings.ts';
import { wordListFindings } from './word-list-findings.ts';

type RegistryFindingsInput = { readonly wordLists: WordLists; readonly contracts: ReadonlyArray<ContractText> };

/**
 * Each place where the registry, its word lists or the files it governs break the standard's rules for rules. It checks
 * their messages, registration, budgets, severities, word lists and path patterns, the installed files the registry
 * loads or copies, and the tree's suppressions.
 */
export const registryFindings = Effect.fn('registryFindings')(function* ({
  wordLists,
  contracts,
}: RegistryFindingsInput): Effect.fn.Return<ReadonlyArray<RegistryFinding>, GenerateFailed> {
  const ruleFiles = yield* readRuleFiles();
  const files = yield* workspaceFiles();
  const entries = assetEntries({ contracts });
  const lock = yield* readLock();
  const installed = yield* readInstalledRuleFiles({ entries, lock });
  const oxlintFiles = yield* readOxlintAssets({ entries });

  return [
    ...messageFindings({ ruleFiles }),
    ...ruleFindings({ ruleFiles }),
    ...assetFindings({ entries, lock, ruleFiles: installed, oxlintFiles }),
    ...derivedRuleFindings({ contracts, lock }),
    ...wordListFindings({ wordLists }),
    ...patternFindings({ ruleFiles, files }),
    ...(yield* suppressionFindings({ files })),
  ];
});
