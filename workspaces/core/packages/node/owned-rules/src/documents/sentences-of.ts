import { CODE_SPAN } from './constants.ts';
import type { TextInput } from './types.ts';

/** The space after a sentence's end, before a capital or a code span. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z`])/;

/** The sentences of prose: a period, question mark or exclamation mark ends one before a capital or a code span. */
export function sentencesOf({ text }: TextInput): ReadonlyArray<string> {
  const readable = text.replaceAll(CODE_SPAN, 'code');

  /** Whether a piece holds more than space. */
  const isSentence: (piece: string) => boolean = (piece) => piece.trim() !== '';

  return readable.split(SENTENCE_BREAK).filter(isSentence);
}
