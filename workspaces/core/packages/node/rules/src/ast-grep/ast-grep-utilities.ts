import { Record } from 'effect';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile, WordLists } from '../types.ts';
import { utilityFile } from './utility-file.ts';
import { wordVariants } from './word-variants.ts';

type AstGrepUtilitiesInput = { readonly wordLists: WordLists };

/**
 * The ast-grep utilities that carry the registry's word lists and limits into the authored rules, which reference them
 * with `matches`. Each list is a regular expression in every case style a name can use.
 */
export function astGrepUtilities({ wordLists }: AstGrepUtilitiesInput): ReadonlyArray<GeneratedFile> {
  const { predicatePrefixes, optionPrefixes, nativeAttributes, keyboardModifiers, externalProperties } =
    CONTRACTS['code-boolean-names'].values;

  const prefixes = wordVariants({ words: [...predicatePrefixes, ...optionPrefixes] });
  const measures = wordVariants({ words: CONTRACTS['code-measured-value-names'].values.measureWords });
  const suffixes = wordVariants({ words: [...wordLists.units, ...wordLists.countedNouns] });

  const booleans = {
    'boolean-prefix': [`^#?(${prefixes.plain})([A-Z_]|$)`, `^(${prefixes.upper})_`],
    'native-boolean-name': [`^['"]?(${nativeAttributes.join('|')})['"]?$`],
    'keyboard-modifier-name': [`^(${keyboardModifiers.join('|')})$`],
    'external-boolean-property': [`^(${externalProperties.join('|')})$`],
  };

  const alternatives = {
    ...booleans,
    'native-denied-name': [
      `^(${CONTRACTS['code-module-structure-and-control-flow'].values.deniedIdentifiers.join('|')})$`,
    ],
    'measure-word': [
      `^#?(${measures.plain})$`,
      `[a-z0-9](${measures.capital})$`,
      `(^|_)(${measures.upper})$`,
      '^#?(max|min)[A-Z]',
      '^(MAX|MIN)_',
    ],
    'unit-suffix': [`(${suffixes.plain})$`, `_(${suffixes.upper})$`],
    ...spelledOutAlternatives(),
  };

  const overflow = CONTRACTS['code-guard-clauses'].values.trailingIfStatements + 1;

  const regexUtility: (alternative: readonly [string, ReadonlyArray<string>]) => GeneratedFile = ([utility, regexes]) =>
    utilityFile({ utility, key: 'regex', value: regexes.join('|'), language: 'TypeScript' });

  const tsxUtility: (alternative: readonly [string, ReadonlyArray<string>]) => GeneratedFile = ([utility, regexes]) => {
    const value = regexes.join('|');

    return utilityFile({ utility: `${utility}-tsx`, key: 'regex', value, language: 'Tsx' });
  };

  return [
    ...Record.toEntries(alternatives).map(regexUtility),
    ...Record.toEntries(booleans).map(tsxUtility),
    utilityFile({ utility: 'trailing-if-overflow', key: 'nthChild', value: overflow, language: 'TypeScript' }),
  ];
}

/**
 * The spelled-out names' utilities: a listed abbreviation in any case style a name can hold it in, and the names that
 * keep an external system's word.
 */
function spelledOutAlternatives(): Readonly<Record<string, ReadonlyArray<string>>> {
  const { wordReplacements, externalNames } = CONTRACTS['code-spelled-out-names'].values;
  const abbreviations = wordVariants({ words: Record.keys(wordReplacements) });

  return {
    'abbreviation': [
      `^#?(${abbreviations.plain})([A-Z0-9_]|$)`,
      `^(${abbreviations.capital})([A-Z0-9_]|$)`,
      `[a-z0-9](${abbreviations.capital})([A-Z0-9_]|$)`,
      `(^|_)(${abbreviations.upper})(_|$)`,
    ],
    'external-name': [`^(${externalNames.join('|')})$`],
  };
}
