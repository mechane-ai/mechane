import { identifierWords } from '@mechane/program';
import { Array } from 'effect';
import type { BannedPhrase } from './types.ts';

/** One synonym a glossary row replaces, and the row's headword. */
type ReplacedPhraseInput = { readonly replaced: string; readonly headword: string };

/** One replaced synonym as a banned phrase, when it holds two or more words. */
export function replacedPhrase({ replaced, headword }: ReplacedPhraseInput): ReadonlyArray<BannedPhrase> {
  const words = identifierWords({ identifier: replaced });

  if (!Array.isReadonlyArrayNonEmpty(words)) {
    return [];
  }

  const [first, ...rest] = words;

  if (rest.length === 0) {
    return [];
  }

  return [{ phrase: replaced.trim(), first, rest, headword }];
}
