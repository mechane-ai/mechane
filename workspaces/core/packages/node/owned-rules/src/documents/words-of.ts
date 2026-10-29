import { CODE_SPAN } from './constants.ts';
import type { TextInput } from './types.ts';

/** A Markdown link, which reads as its text. */
const LINK = /\[([^\]]*)\]\([^)]*\)/g;

/** A run of space between words. */
const SPACE = /\s+/;

/** A word character, which a word holds at least one of. */
const WORD_CHARACTER = /\w/;

/** The words of prose, counting a code span or a link as the words a reader sees. */
export function wordsOf({ text }: TextInput): ReadonlyArray<string> {
  const readable = text.replaceAll(CODE_SPAN, 'code').replaceAll(LINK, '$1');

  return readable.split(SPACE).filter((word) => WORD_CHARACTER.test(word));
}
