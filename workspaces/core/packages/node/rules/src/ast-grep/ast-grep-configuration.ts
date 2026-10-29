import { RuleTool } from '@mechane/rule-shapes';
import { Array } from 'effect';
import { assetEntries } from '../assets/asset-entries.ts';
import type { AssetEntry, ContractText, GeneratedFile } from '../types.ts';
import { AST_GREP_RULES, AST_GREP_TESTS, AST_GREP_UTILITIES, GENERATED_HEADER } from './constants.ts';

/** ast-grep's configuration, relative to the workspace, which names the folders of the rules and their utilities. */
const AST_GREP_CONFIGURATION = 'sgconfig.yml';

type AstGrepConfigurationInput = { readonly contracts: ReadonlyArray<ContractText> };

/**
 * `sgconfig.yml`: the folder of the authored rules, then each installed rule folder a rule loads in place, the folder
 * of their utilities, and the folder of their tests.
 */
export function astGrepConfiguration({ contracts }: AstGrepConfigurationInput): GeneratedFile {
  const isScanned: (entry: AssetEntry) => boolean = ({ rule }) => rule.tool === RuleTool.AstGrep;

  const installed = assetEntries({ contracts })
    .filter(isScanned)
    .map(({ path }) => path);

  const folderLine: (folder: string) => string = (folder) => `  - ${folder}`;

  const text = [
    GENERATED_HEADER,
    'ruleDirs:',
    ...[AST_GREP_RULES, ...Array.dedupe(installed)].map(folderLine),
    'utilDirs:',
    `  - ${AST_GREP_UTILITIES}`,
    'testConfigs:',
    `  - testDir: ${AST_GREP_TESTS}`,
    '',
  ];

  return { path: AST_GREP_CONFIGURATION, text: text.join('\n') };
}
