import { WordList } from '@mechane/rule-shapes';
import { CONTRACTS, wordListPath } from '@mechane/rules';
import type { WordLists } from '@mechane/rules';
import { Record } from 'effect';
import type { RegistryFinding } from '../types.ts';

type WordListFindingsInput = { readonly wordLists: WordLists };

/** Each acronym that the spelled-out names replace, which a name could then never hold. */
export function wordListFindings({ wordLists }: WordListFindingsInput): ReadonlyArray<RegistryFinding> {
  const replaced: ReadonlySet<string> = new Set(
    Record.keys(CONTRACTS['code-spelled-out-names'].values.wordReplacements),
  );

  const replacedFinding: (word: string) => RegistryFinding = (word) => ({
    path: wordListPath({ list: WordList.Acronyms }),
    message: `Remove ${word} from the list or remove its replacement, such as \`${word}\`, since the word replacements spell it out (NM-05)`,
  });

  return wordLists.acronyms.filter((word) => replaced.has(word)).map(replacedFinding);
}
