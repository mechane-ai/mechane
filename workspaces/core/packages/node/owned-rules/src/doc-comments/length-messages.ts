import { CONTRACTS } from '@mechane/rules';
import type { Comment } from 'oxc-parser';
import { sentencesOf } from '../documents/sentences-of.ts';
import { wordsOf } from '../documents/words-of.ts';
import { docText } from './doc-text.ts';

type LengthMessagesInput = { readonly doc: Comment };

/** What a doc past its limits should do: hold fewer sentences, and split each sentence past the word limit. */
export function lengthMessages({ doc }: LengthMessagesInput): ReadonlyArray<string> {
  const sentences = sentencesOf({ text: docText({ doc }) });
  const { docSentences, docSentenceWords } = CONTRACTS['code-comment-content'].values;

  const sentenceMessages: ReadonlyArray<string> = (() => {
    if (sentences.length <= docSentences) {
      return [];
    }

    return [
      `Write its ${sentences.length} sentences as at most ${docSentences}, such as \`What it holds\` and \`Why it waits\``,
    ];
  })();

  /** The words a sentence holds. */
  const sentenceWords: (sentence: string) => number = (sentence) => wordsOf({ text: sentence }).length;

  /** What a sentence past the word limit should do. */
  const splitMessage: (words: number) => string = (words) =>
    `Split its sentence of ${words} words into ones of at most ${docSentenceWords}, such as \`It holds the turns\` and \`It drops them\``;

  const wordMessages = sentences
    .map(sentenceWords)
    .filter((words) => words > docSentenceWords)
    .map(splitMessage);

  return [...sentenceMessages, ...wordMessages];
}
