import { siteKey } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';
import { sentencesOf } from './sentences-of.ts';
import type { Block } from './types.ts';
import { wordsOf } from './words-of.ts';

/** A document's path, and one paragraph or list item of its prose. */
type BlockFindingsInput = { readonly path: string; readonly block: Block };

/** Each sentence of a block past the word limit, and a paragraph past the sentence limit. */
export function blockFindings({ path, block }: BlockFindingsInput): ReadonlyArray<Finding> {
  const { sentenceWords, paragraphSentences } = CONTRACTS['docs-prose-style'].values;
  const sentences = sentencesOf({ text: block.text });
  const location = siteKey({ file: path, line: block.line });

  /** The finding of a sentence past the word limit. */
  const longFindings: (sentence: string) => ReadonlyArray<Finding> = (sentence) => {
    const words = wordsOf({ text: sentence }).length;

    if (words <= sentenceWords) {
      return [];
    }

    const message = `Split the sentence into sentences of at most ${sentenceWords} words, such as \`It runs\` and \`It stops\`, since it holds ${words}`;

    return [{ check: 'documents', location, message }];
  };

  const long = sentences.flatMap(longFindings);

  if (block.isListItem || sentences.length <= paragraphSentences) {
    return long;
  }

  const message = `Split the paragraph into paragraphs of at most ${paragraphSentences} sentences, such as \`\\n\\n\` between two, since it holds ${sentences.length}`;

  return [...long, { check: 'documents', location, message }];
}
